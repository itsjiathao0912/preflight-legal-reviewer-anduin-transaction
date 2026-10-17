/**
 * Shared client-side download (Phase 09 outline JSON, Phase 08 query sheet DOCX). Frozen contract:
 * `downloadBlob(filename: string, data: string | Blob, mime: string): void`. A Blob is passed
 * through unwrapped; the object URL is revoked after REVOKE_DELAY_MS (not on the next tick) so
 * slow browsers can finish resolving the blob URL before it is released.
 */
export const REVOKE_DELAY_MS = 60_000;

export function downloadBlob(filename: string, data: string | Blob, mime: string): void {
  const blob = typeof data === 'string' ? new Blob([data], { type: mime }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.type = mime;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
  }
}
