import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { signUploadUrl } from '../utils/signed-media.util';

const URL_KEYS = new Set(['pdfUrl', 'videoUrl', 'lessonPdfUrl']);
// Large payloads that never hold these URLs — walking them is wasted work.
const SKIP_KEYS = new Set(['noteData', 'rawText', 'lessonContent', 'questions']);
const MAX_DEPTH = 6;

/**
 * Adds the file signature to lesson PDF / video URLs in a response.
 *
 * Done here, on the way out, rather than in the lesson mappers, because those
 * mappers also feed admin edits and version snapshots: a signature written back
 * into the database would corrupt the stored path. Here the stored value is
 * never touched.
 *
 * An object that says the reader can't open it (`canAccess: false` or
 * `accessLocked: true`) is left unsigned, so a locked lesson never receives a
 * working link.
 */
@Injectable()
export class SignUploadUrlsInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((body) => sign(body, 0)));
  }
}

export function sign(node: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH || node === null || typeof node !== 'object') return node;
  // Only plain JSON-shaped data. A Buffer, stream or StreamableFile (a file
  // download) must pass through untouched, and untraversed.
  if (!Array.isArray(node)) {
    const proto = Object.getPrototypeOf(node);
    if (proto !== Object.prototype && proto !== null) return node;
  }

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) node[i] = sign(node[i], depth + 1);
    return node;
  }

  const obj = node as Record<string, unknown>;
  const locked = obj.canAccess === false || obj.accessLocked === true;
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (URL_KEYS.has(key) && typeof value === 'string') {
      if (!locked) obj[key] = signUploadUrl(value);
    } else if (value && typeof value === 'object' && !SKIP_KEYS.has(key)) {
      obj[key] = sign(value, depth + 1);
    }
  }
  return obj;
}
