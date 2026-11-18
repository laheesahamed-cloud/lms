"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var NoticesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoticesService = exports.FEED_LIMIT = void 0;
const common_1 = require("@nestjs/common");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
exports.FEED_LIMIT = 30;
const RELOAD_CHECK_MS = 2000;
class JsonStore {
    constructor(file, logger) {
        this.file = file;
        this.logger = logger;
        this.data = { nextId: 1, items: [] };
        this.mtime = 0;
        this.checkedAt = 0;
        this.load();
    }
    load() {
        try {
            const raw = (0, node_fs_1.readFileSync)(this.file, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.items)) {
                this.data = { nextId: Number(parsed.nextId) || 1, items: parsed.items };
            }
            this.mtime = (0, node_fs_1.statSync)(this.file).mtimeMs;
        }
        catch (error) {
            if (error?.code !== 'ENOENT')
                this.logger.warn(`Could not read ${this.file}: ${error?.message || error}`);
        }
    }
    read() {
        const now = Date.now();
        if (now - this.checkedAt > RELOAD_CHECK_MS) {
            this.checkedAt = now;
            try {
                if ((0, node_fs_1.statSync)(this.file).mtimeMs !== this.mtime)
                    this.load();
            }
            catch { }
        }
        return this.data;
    }
    write(change) {
        this.checkedAt = 0;
        this.read();
        const next = { nextId: this.data.nextId, items: [...this.data.items] };
        change(next);
        (0, node_fs_1.mkdirSync)((0, node_path_1.join)(this.file, '..'), { recursive: true });
        const tmp = `${this.file}.${process.pid}.tmp`;
        (0, node_fs_1.writeFileSync)(tmp, JSON.stringify(next));
        (0, node_fs_1.renameSync)(tmp, this.file);
        this.data = next;
        try {
            this.mtime = (0, node_fs_1.statSync)(this.file).mtimeMs;
        }
        catch { }
    }
}
let NoticesService = NoticesService_1 = class NoticesService {
    constructor() {
        this.logger = new common_1.Logger(NoticesService_1.name);
        this.dir = process.env.NOTICES_DIR || (0, node_path_1.join)(process.cwd(), 'storage', 'notices');
        this.feed = new JsonStore((0, node_path_1.join)(this.dir, 'feed.json'), this.logger);
        this.popups = new JsonStore((0, node_path_1.join)(this.dir, 'popups.json'), this.logger);
    }
    addNotice(input) {
        let notice;
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
            if (data.items.length > exports.FEED_LIMIT)
                data.items.splice(0, data.items.length - exports.FEED_LIMIT);
        });
        return notice;
    }
    noticesFor(role, afterId = 0) {
        const data = this.feed.read();
        const items = data.items
            .filter((n) => n.id > afterId && seesAudience(role, n.audience))
            .sort((a, b) => b.id - a.id);
        return { items, latestId: Math.max(0, data.nextId - 1) };
    }
    popupsFor(role, now = new Date()) {
        const t = now.getTime();
        return this.popups.read().items
            .filter((p) => p.status === 'active' && seesAudience(role, p.audience))
            .filter((p) => !p.endAt || new Date(p.endAt).getTime() > t)
            .sort((a, b) => b.priority - a.priority || b.id - a.id);
    }
    listPopups() {
        return [...this.popups.read().items].sort((a, b) => b.id - a.id);
    }
    createPopup(input) {
        const fields = normalizePopupInput(input);
        let popup;
        this.popups.write((data) => {
            const now = new Date().toISOString();
            popup = { id: data.nextId, ...fields, createdAt: now, updatedAt: now };
            data.nextId += 1;
            data.items.push(popup);
        });
        return popup;
    }
    updatePopup(id, input) {
        const fields = normalizePopupInput(input);
        let popup = null;
        this.popups.write((data) => {
            const index = data.items.findIndex((p) => p.id === id);
            if (index < 0)
                return;
            popup = { ...data.items[index], ...fields, updatedAt: new Date().toISOString() };
            data.items[index] = popup;
        });
        if (!popup)
            throw new common_1.NotFoundException('Announcement not found');
        return popup;
    }
    deletePopup(id) {
        let found = false;
        this.popups.write((data) => {
            const before = data.items.length;
            data.items = data.items.filter((p) => p.id !== id);
            found = data.items.length < before;
        });
        if (!found)
            throw new common_1.NotFoundException('Announcement not found');
    }
};
exports.NoticesService = NoticesService;
exports.NoticesService = NoticesService = NoticesService_1 = __decorate([
    (0, common_1.Injectable)()
], NoticesService);
function seesAudience(role, audience) {
    if (audience === 'all')
        return true;
    if (audience === 'admin')
        return role !== 'student';
    return role === 'student';
}
function normalizeAudience(value, fallback) {
    return value === 'all' || value === 'student' || value === 'admin' ? value : fallback;
}
function safePath(value) {
    const path = String(value || '').trim();
    return path.startsWith('/') && !path.startsWith('//') ? path.slice(0, 300) : '';
}
function isoOrNull(value) {
    if (value === null || value === undefined || value === '')
        return null;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime()))
        throw new common_1.BadRequestException('Invalid date');
    return date.toISOString();
}
function normalizePopupInput(input) {
    const title = String(input?.title || '').trim();
    const body = String(input?.body || '').trim();
    if (!title)
        throw new common_1.BadRequestException('Title is required');
    if (!body)
        throw new common_1.BadRequestException('Text is required');
    const startAt = isoOrNull(input?.startAt ?? input?.publishAt);
    const endAt = isoOrNull(input?.endAt);
    if (startAt && endAt && new Date(endAt) <= new Date(startAt)) {
        throw new common_1.BadRequestException('The end must be after the start');
    }
    const image = String(input?.imageUrl || '').trim();
    return {
        style: input?.style === 'banner' ? 'banner' : 'card',
        title: title.slice(0, 120),
        body: body.slice(0, 600),
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
//# sourceMappingURL=notices.service.js.map