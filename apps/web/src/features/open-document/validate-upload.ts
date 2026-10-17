import { limits } from '@aduin/core';

/**
 * Upload validation (AC37): runs before any AI/OCR call. Phase 06: PDF, Word and JPEG/PNG are
 * accepted; the engine worker then checks the content against the extension (magic bytes) and the
 * 30-page limit before any page is read or sent to OCR.
 */
export type UploadKind = 'html' | 'pdf' | 'docx' | 'image';
export type UploadCheck =
  { ok: true; kind: UploadKind } | { ok: false; kind: 'error'; message: string };

export const ACCEPT = limits.uploadExtensions.join(',');

export function limitsCopy(): string {
  const mb = Math.round(limits.maxUploadBytes / (1024 * 1024));
  return `Up to ${mb} MB, scans up to ${limits.maxScanPages} pages. Accepted: ${limits.uploadExtensions.join(', ')}`;
}

export function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

export function checkUpload(name: string, size: number): UploadCheck {
  const ext = extOf(name);
  if (!(limits.uploadExtensions as readonly string[]).includes(ext)) {
    return {
      ok: false,
      kind: 'error',
      message: `This file type is not supported. Use ${limits.uploadExtensions.join(', ')}.`,
    };
  }
  if (size === 0) return { ok: false, kind: 'error', message: 'This file is empty.' };
  if (size > limits.maxUploadBytes) {
    const mb = Math.round(limits.maxUploadBytes / (1024 * 1024));
    return { ok: false, kind: 'error', message: `This file is over the ${mb} MB limit.` };
  }
  if (ext === '.htm' || ext === '.html') return { ok: true, kind: 'html' };
  if (ext === '.pdf') return { ok: true, kind: 'pdf' };
  if (ext === '.docx') return { ok: true, kind: 'docx' };
  return { ok: true, kind: 'image' };
}
