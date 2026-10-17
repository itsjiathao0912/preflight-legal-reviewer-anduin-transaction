import { diffArrays } from 'diff';
import { sensitiveSpans, type Span } from '../memory/mask';
import type { Excerpt, Segment } from './types';

/**
 * Word-level text diff (B2) with span-aware segments (E17).
 *
 * Sensitive spans are found ONCE on the whole raw block text and each span becomes one atomic
 * token, so jsdiff (`diffArrays`, the token form of `diffWords`) can never split a number across
 * segments; segment `sensitiveSpans` are those whole-text spans mapped to segment offsets.
 * `maxEditLength` bounds the work; when jsdiff returns `undefined` the diff falls back to a coarse
 * whole-block replace (one `del` + one `add`) flagged `truncated`. No `timeout` option is used:
 * a wall-clock bound would make the output depend on machine speed (determinism, E6).
 */

export const MAX_EDIT_LENGTH = 1500;
/** Unchanged runs longer than this are clipped to head + gap + tail. */
export const SAME_CLIP = 160;
const SAME_KEEP = 60;
/** Added / removed runs longer than this are clipped to head + gap + tail. */
export const CHANGE_CLIP = 900;
const CHANGE_KEEP = 420;
/** Hard cap on segments per diff (kept deterministic: the tail becomes one gap). */
export const MAX_SEGMENTS = 400;

export interface Token {
  text: string;
  start: number;
  sensitive: boolean;
  ws: boolean;
}

const WORD_RE = /\s+|[\p{L}\p{N}][\p{L}\p{N}'’_-]*|[^\s\p{L}\p{N}]/gu;

/** Tokenize with each sensitive span (computed on the whole text) as one atomic token. */
export function tokenize(text: string, spans: Span[] = sensitiveSpans(text)): Token[] {
  const out: Token[] = [];
  const merged = mergeSpans(spans);
  let pos = 0;
  const words = (from: number, to: number) => {
    const chunk = text.slice(from, to);
    for (const m of chunk.matchAll(WORD_RE)) {
      out.push({
        text: m[0],
        start: from + m.index!,
        sensitive: false,
        ws: /^\s+$/.test(m[0]),
      });
    }
  };
  for (const sp of merged) {
    if (sp.start > pos) words(pos, sp.start);
    out.push({ text: text.slice(sp.start, sp.end), start: sp.start, sensitive: true, ws: false });
    pos = sp.end;
  }
  if (pos < text.length) words(pos, text.length);
  return out;
}

export function mergeSpans(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end);
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out.at(-1);
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else if (s.end > s.start) out.push({ start: s.start, end: s.end });
  }
  return out;
}

/** Build one segment from a token run; spans are the atomic sensitive tokens it contains. */
function segmentOf(op: Segment['op'], toks: readonly Token[]): Segment {
  let text = '';
  const spans: Span[] = [];
  for (const t of toks) {
    if (t.sensitive) spans.push({ start: text.length, end: text.length + t.text.length });
    text += t.text;
  }
  return { op, text, sensitiveSpans: spans };
}

/** Clip a token run at token boundaries (never inside a sensitive token) into head + gap + tail. */
function pushRun(out: Segment[], op: 'same' | 'del' | 'add', toks: readonly Token[]) {
  if (toks.length === 0) return;
  const len = toks.reduce((n, t) => n + t.text.length, 0);
  const [limit, keep] = op === 'same' ? [SAME_CLIP, SAME_KEEP] : [CHANGE_CLIP, CHANGE_KEEP];
  if (len <= limit) {
    out.push(segmentOf(op, toks));
    return;
  }
  let h = 0;
  let hl = 0;
  while (h < toks.length && hl + toks[h]!.text.length <= keep) hl += toks[h++]!.text.length;
  let t = toks.length;
  let tl = 0;
  while (t > h && tl + toks[t - 1]!.text.length <= keep) tl += toks[--t]!.text.length;
  if (h > 0) out.push(segmentOf(op, toks.slice(0, h)));
  out.push({ op: 'gap', text: '', sensitiveSpans: [] });
  if (t < toks.length) out.push(segmentOf(op, toks.slice(t)));
}

export interface TokenDiffPart {
  op: 'same' | 'del' | 'add';
  a: Token[];
  b: Token[];
}

export interface TextDiff {
  parts: TokenDiffPart[] | undefined;
  segments: Segment[];
  truncated: boolean;
}

const sameTok = (x: Token, y: Token) => (x.ws && y.ws) || x.text === y.text;

/** Token diff of two raw texts. `maxEditLength` is overridable for the fallback test. */
export function diffText(a: string, b: string, maxEditLength = MAX_EDIT_LENGTH): TextDiff {
  const ta = tokenize(a);
  const tb = tokenize(b);
  const changes = diffArrays(ta, tb, { comparator: sameTok, maxEditLength });
  if (!changes) {
    const segments: Segment[] = [];
    pushRun(segments, 'del', ta);
    pushRun(segments, 'add', tb);
    return { parts: undefined, segments, truncated: true };
  }
  const parts: TokenDiffPart[] = [];
  let ia = 0;
  let ib = 0;
  for (const c of changes) {
    const n = c.count ?? c.value.length;
    if (c.added) {
      parts.push({ op: 'add', a: [], b: tb.slice(ib, ib + n) });
      ib += n;
    } else if (c.removed) {
      parts.push({ op: 'del', a: ta.slice(ia, ia + n), b: [] });
      ia += n;
    } else {
      parts.push({ op: 'same', a: ta.slice(ia, ia + n), b: tb.slice(ib, ib + n) });
      ia += n;
      ib += n;
    }
  }
  const segments: Segment[] = [];
  for (const p of parts) pushRun(segments, p.op, p.op === 'add' ? p.b : p.a);
  if (segments.length > MAX_SEGMENTS) {
    segments.length = MAX_SEGMENTS - 1;
    segments.push({ op: 'gap', text: '', sensitiveSpans: [] });
  }
  return { parts, segments, truncated: false };
}

/** Diff segments for a pure addition or removal (whole text, clipped). */
export function wholeSegments(op: 'del' | 'add', text: string): Segment[] {
  const out: Segment[] = [];
  pushRun(out, op, tokenize(text));
  return out;
}

export const EXCERPT_PAD = 110;

/**
 * Span-aware clipped RAW excerpt around [start, end) (the structure-view `excerpt()` widening:
 * the window is widened so it never cuts a sensitive span, then snapped to word bounds). Spans are
 * computed on the whole text and mapped into the window; no ellipsis is put in the text.
 */
export function excerptOf(
  text: string,
  start = 0,
  end = Math.min(text.length, 2 * EXCERPT_PAD),
  pad = EXCERPT_PAD,
): Excerpt {
  const spans = mergeSpans(sensitiveSpans(text));
  let a = Math.max(0, start - pad);
  let b = Math.min(text.length, end + pad);
  if (b - a > 1600) b = a + 1600;
  for (const sp of spans) {
    if (sp.start < a && sp.end > a) a = sp.start;
    if (sp.start < b && sp.end > b) b = sp.end;
  }
  if (a > 0) {
    const sp = text.indexOf(' ', a);
    if (sp !== -1 && sp < start && !spans.some((s) => s.start <= sp && s.end > sp)) a = sp + 1;
  }
  if (b < text.length) {
    const sp = text.lastIndexOf(' ', b);
    if (sp > end && !spans.some((s) => s.start <= sp && s.end > sp)) b = sp;
  }
  let slice = text.slice(a, b);
  const lead = slice.length - slice.trimStart().length;
  slice = slice.trim();
  const off = a + lead;
  const inside = spans
    .filter((s) => s.start >= off && s.end <= off + slice.length)
    .map((s) => ({ start: s.start - off, end: s.end - off }));
  // schema cap: cut before any span that would straddle the cap (never split a span)
  let cut = slice.length;
  if (cut > 2000) {
    cut = 2000;
    for (const s of inside) if (s.start < cut && s.end > cut) cut = s.start;
  }
  return {
    text: slice.slice(0, cut),
    sensitiveSpans: inside.filter((s) => s.end <= cut),
    clippedStart: a > 0,
    clippedEnd: b < text.length || cut < slice.length,
  };
}
