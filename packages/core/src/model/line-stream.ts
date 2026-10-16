import type { Line, LineStream } from './types';

/** Collect any LineStream (array or async iterable) into an array. */
export async function collectLines(stream: LineStream): Promise<Line[]> {
  if (Array.isArray(stream)) return stream;
  const out: Line[] = [];
  for await (const line of stream) out.push(line);
  return out;
}

/** Letters-uppercase ratio >= 0.8 with at least 3 letters. */
export function isCaps(text: string): boolean {
  let letters = 0;
  let upper = 0;
  for (const ch of text) {
    const lower = ch.toLowerCase();
    const up = ch.toUpperCase();
    if (lower === up) continue;
    letters++;
    if (ch === up) upper++;
  }
  return letters >= 3 && upper / letters >= 0.8;
}
