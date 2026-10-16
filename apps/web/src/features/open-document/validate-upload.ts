import { limits } from '@aduin/core';

/** Upload validation (AC37): runs before any AI call. Page-count rows activate in P06. */
export type UploadCheck =
  | { ok: true; kind: 'html' }
  | { ok: false; kind: 'later'; message: string }
  | { ok: false; kind: 'error'; message: string };

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
  return {
    ok: false,
    kind: 'later',
    message: 'PDF, Word and image files are supported in a later build.',
  };
}
