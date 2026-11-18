import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Notifications without MySQL (OPTIMIZE 10, step 4).
 *
 * Two small JSON files on the server (backend/storage/notices, not in git):
 *
 *  feed.json    the last FEED_LIMIT notices for everyone: new content and
 *               admin messages. Phones get the ones newer than the last id
 *               they hold, inside the start-up reply, and keep their own
 *               inbox (read / cleared) on the phone. No per-student rows.
 *  popups.json  admin announcements shown inside the app: a centre card or
 *               a Study Hub banner, with a start and end time, a priority
 *               and an audience. Phones show one at a time, highest priority
 *               first, each once per device, and keep them for offline use.
 *
 * Both are kept in memory. Writes go to a temp file then rename (atomic), so a
 * crash never leaves half a file. If another server process wrote the file,
 * its newer modification time makes this process read it again (checked at
 * most once every RELOAD_CHECK_MS), so all processes agree.
 */
export const FEED_LIMIT = 30;
const RELOAD_CHECK_MS = 2000;

export type Audience = 'all' | 'student' | 'admin';

export type Notice = {
  id: number;
  kind: 'content' | 'admin';
  title: string;
  body: string;
  url: string;
  audience: Audience;
  createdAt: string;
};

export type Popup = {
  id: number;
  style: 'card' | 'banner';
  title: string;
  body: string;
  imageUrl: string;
  actionLabel: string;
  actionPath: string;
  startAt: string | null; // ISO; null = now
  endAt: string | null;   // ISO; null = no end
  priority: number;       // higher first
  audience: Audience;
  status: 'active' | 'draft';
  createdAt: string;
  updatedAt: string;
};

type FileShape<T> = { nextId: number; items: T[] };

class JsonStore<T extends { id: number }> {
  private data: FileShape<T> = { nextId: 1, items: [] };
  private mtime = 0;
  private checkedAt = 0;

  constructor(private readonly file: string, private readonly logger: Logger) {
    this.load();
  }

  private load() {
    try {
      const raw = readFileSync(this.file, 'utf8');
      const parsed = JSON.parse(raw) as FileShape<T>;
      if (parsed && Array.isArray(parsed.items)) {
        this.data = { nextId: Number(parsed.nextId) || 1, items: parsed.items };
      }
      this.mtime = statSync(this.file).mtimeMs;
    } catch (error: any) {
      if (error?.code !== 'ENOENT') this.logger.warn(`Could not read ${this.file}: ${error?.message || error}`);
    }
  }

  /** The current data, re-read when another process changed the file. */
  read(): FileShape<T> {
    const now = Date.now();
    if (now - this.checkedAt > RELOAD_CHECK_MS) {
      this.checkedAt = now;
      try {
        if (statSync(this.file).mtimeMs !== this.mtime) this.load();
      } catch { /* no file yet */ }
    }
    return this.data;
  }

  /** Change and save: reads the newest copy first, then writes it atomically. */
  write(change: (data: FileShape<T>) => void) {
    this.checkedAt = 0;
    this.read();
    const next: FileShape<T> = { nextId: this.data.nextId, items: [...this.data.items] };
    change(next);
    mkdirSync(join(this.file, '..'), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(next));
    renameSync(tmp, this.file);
    this.data = next;
    try { this.mtime = statSync(this.file).mtimeMs; } catch { /* ignore */ }
  }
}

@Injectable()
export class NoticesService {
  private readonly logger = new Logger(NoticesService.name);
  private readonly dir = process.env.NOTICES_DIR || join(process.cwd(), 'storage', 'notices');
  private readonly feed = new JsonStore<Notice>(join(this.dir, 'feed.json'), this.logger);
  private readonly popups = new JsonStore<Popup>(join(this.dir, 'popups.json'), this.logger);

  // ── feed ──────────────────────────────────────────────────────────────────

  /** Adds a notice; the oldest beyond FEED_LIMIT drop off. Returns it (for the push). */
  addNotice(input: { kind: Notice['kind']; title: string; body: string; url?: string; audience?: Audience }): Notice {
    let notice!: Notice;
    this.feed.write((data) => {
      notice = {
        id: data.nextId,
        kind: input.kind,
        title: String(input.title || 'xyndrome').slice(0, 180),
        body: String(input.body || '').slice(0, 1000),
        url: safePath(input.url) || '/notifications',
        audience: normalizeAudience(input.audience, 'student'),
        createdAt: new Date().toISOString(),
      };
      data.nextId += 1;
      data.items.push(notice);
      if (data.items.length > FEED_LIMIT) data.items.splice(0, data.items.length - FEED_LIMIT);
    });
    return notice;
  }

  /** Notices for this role newer than `afterId`, newest first (at most FEED_LIMIT). */
  noticesFor(role: string, afterId = 0): { items: Notice[]; latestId: number } {
    const data = this.feed.read();
    const items = data.items
      .filter((n) => n.id > afterId && seesAudience(role, n.audience))
      .sort((a, b) => b.id - a.id);
    return { items, latestId: Math.max(0, data.nextId - 1) };
  }

  // ── popups ────────────────────────────────────────────────────────────────

  /** Active popups for this role whose window has not ended, highest priority first. */
  popupsFor(role: string, now = new Date()): Popup[] {
    const t = now.getTime();
    return this.popups.read().items
      .filter((p) => p.status === 'active' && seesAudience(role, p.audience))
      .filter((p) => !p.endAt || new Date(p.endAt).getTime() > t)
      .sort((a, b) => b.priority - a.priority || b.id - a.id);
  }

  listPopups(): Popup[] {
    return [...this.popups.read().items].sort((a, b) => b.id - a.id);
  }

  createPopup(input: any): Popup {
    const fields = normalizePopupInput(input);
    let popup!: Popup;
    this.popups.write((data) => {
      const now = new Date().toISOString();
      popup = { id: data.nextId, ...fields, createdAt: now, updatedAt: now };
      data.nextId += 1;
      data.items.push(popup);
    });
    return popup;
  }

  updatePopup(id: number, input: any): Popup {
    const fields = normalizePopupInput(input);
    let popup: Popup | null = null;
    this.popups.write((data) => {
      const index = data.items.findIndex((p) => p.id === id);
      if (index < 0) return;
      popup = { ...data.items[index], ...fields, updatedAt: new Date().toISOString() };
      data.items[index] = popup;
    });
    if (!popup) throw new NotFoundException('Announcement not found');
    return popup;
  }

  deletePopup(id: number) {
    let found = false;
    this.popups.write((data) => {
      const before = data.items.length;
      data.items = data.items.filter((p) => p.id !== id);
      found = data.items.length < before;
    });
    if (!found) throw new NotFoundException('Announcement not found');
  }
}

function seesAudience(role: string, audience: Audience) {
  if (audience === 'all') return true;
  if (audience === 'admin') return role !== 'student';
  return role === 'student';
}

function normalizeAudience(value: unknown, fallback: Audience): Audience {
  return value === 'all' || value === 'student' || value === 'admin' ? value : fallback;
}

/** Only in-app paths ("/something"), never another site. */
function safePath(value: unknown) {
  const path = String(value || '').trim();
  return path.startsWith('/') && !path.startsWith('//') ? path.slice(0, 300) : '';
}

function isoOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid date');
  return date.toISOString();
}

function normalizePopupInput(input: any): Omit<Popup, 'id' | 'createdAt' | 'updatedAt'> {
  const title = String(input?.title || '').trim();
  const body = String(input?.body || '').trim();
  if (!title) throw new BadRequestException('Title is required');
  if (!body) throw new BadRequestException('Text is required');
  const startAt = isoOrNull(input?.startAt ?? input?.publishAt);
  const endAt = isoOrNull(input?.endAt);
  if (startAt && endAt && new Date(endAt) <= new Date(startAt)) {
    throw new BadRequestException('The end must be after the start');
  }
  const image = String(input?.imageUrl || '').trim();
  return {
    style: input?.style === 'banner' ? 'banner' : 'card',
    title: title.slice(0, 120),
    body: body.slice(0, 600),
    // A picture only on centre cards; https or an in-app path.
    imageUrl: input?.style === 'banner' ? '' : (/^https:\/\//i.test(image) || safePath(image) ? image.slice(0, 500) : ''),
    actionLabel: String(input?.actionLabel || '').trim().slice(0, 40),
    actionPath: safePath(input?.actionPath),
    startAt,
    endAt,
    priority: Math.max(0, Math.min(100, Math.round(Number(input?.priority) || 0))),
    audience: normalizeAudience(input?.audience ?? input?.targetRole, 'student'),
    status: input?.status === 'draft' ? 'draft' : 'active',
  };
}
