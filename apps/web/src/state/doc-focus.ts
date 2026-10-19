import { create } from 'zustand';

/**
 * "Show in document" target for the sub doc reading pane: a block (and optionally the quoted span
 * inside it) to scroll to and highlight. Works without a finding on the block. The highlight
 * stays until the next navigation (another focus, a finding selection, or a new document).
 */
export interface DocFocus {
  blockId: string;
  quote: string | null;
}

interface DocFocusState {
  focus: DocFocus | null;
  /** Bumped on every request so the same target re-scrolls and re-flashes. */
  seq: number;
  show: (blockId: string, quote?: string | null) => void;
  clear: () => void;
}

export const useDocFocus = create<DocFocusState>((set, get) => ({
  focus: null,
  seq: 0,
  show: (blockId, quote = null) =>
    set({ focus: { blockId, quote: quote && quote.trim() ? quote : null }, seq: get().seq + 1 }),
  clear: () => set({ focus: null }),
}));

const norm = (s: string) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").toLowerCase();

/**
 * Character range of `quote` inside `text` (case/quote-mark/whitespace tolerant). Leading and
 * trailing quote marks and an ellipsis are ignored; falls back to the longest leading prefix of at
 * least 12 characters. Null when the span cannot be located.
 */
export function locateQuote(text: string, quote: string): { start: number; end: number } | null {
  const q = quote.replace(/^[\s"'“”‘’«»…]+|[\s"'“”‘’«»…]+$/g, '').replace(/\s+/g, ' ');
  if (!q) return null;
  // map collapsed-whitespace positions back to the original text
  const idx: number[] = [];
  let flat = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (/\s/.test(c)) {
      if (flat.endsWith(' ') || flat === '') continue;
      flat += ' ';
    } else flat += c;
    idx.push(i);
  }
  const hay = norm(flat);
  let len = q.length;
  for (;;) {
    const needle = norm(q.slice(0, len)).trim();
    const at = needle ? hay.indexOf(needle) : -1;
    if (at >= 0) return { start: idx[at]!, end: idx[at + needle.length - 1]! + 1 };
    if (len <= 12) break;
    len = Math.max(12, Math.floor(len * 0.75));
  }
  return null;
}

/** DOM Range over [start, end) of `el`'s text content (text nodes walked in order). */
export function textRange(el: HTMLElement, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let pos = 0;
  let began = false;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const len = n.textContent?.length ?? 0;
    if (!began && start < pos + len) {
      range.setStart(n, start - pos);
      began = true;
    }
    if (began && end <= pos + len) {
      range.setEnd(n, end - pos);
      return range;
    }
    pos += len;
  }
  return null;
}
