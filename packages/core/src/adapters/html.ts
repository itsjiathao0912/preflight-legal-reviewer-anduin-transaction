import { Parser } from 'htmlparser2';
import { limits } from '../config/limits';
import { CoreError } from '../model/errors';
import { sha256Hex } from '../model/hash';
import { isCaps } from '../model/line-stream';
import type { Cue, Line } from '../model/types';

/**
 * HTML adapter: htmlparser2 SAX -> Line[] with cues.
 * - all cells of a <tr> are merged (space-separated) into one Line
 * - bold cue = nearest weight declaration walking ancestors (tag or inline CSS)
 * - checkbox glyphs normalized to U+2610 (empty) / U+2612 (checked)
 * - EDGAR noise pre-pass with an auditable rule list
 * - cp1252 remap for C1 code points (numeric entities 128-159)
 * Never touches `document`/`window`: runs in Workers, Node and Web Workers.
 */

const BLOCK_TAGS = new Set([
  'p',
  'div',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'table',
  'center',
  'blockquote',
  'ul',
  'ol',
  'dl',
  'dt',
  'dd',
  'hr',
  'pre',
  'section',
  'article',
  'header',
  'footer',
  'body',
]);
const SKIP_TAGS = new Set(['script', 'style', 'head', 'title', 'noscript', 'template']);
const VOID_TAGS = new Set([
  'br',
  'hr',
  'img',
  'input',
  'meta',
  'link',
  'col',
  'area',
  'base',
  'wbr',
]);

/** cp1252 mapping for U+0080..U+009F (undefined slots map to themselves). */
const CP1252: Record<number, number> = {
  0x80: 0x20ac,
  0x82: 0x201a,
  0x83: 0x0192,
  0x84: 0x201e,
  0x85: 0x2026,
  0x86: 0x2020,
  0x87: 0x2021,
  0x88: 0x02c6,
  0x89: 0x2030,
  0x8a: 0x0160,
  0x8b: 0x2039,
  0x8c: 0x0152,
  0x8e: 0x017d,
  0x91: 0x2018,
  0x92: 0x2019,
  0x93: 0x201c,
  0x94: 0x201d,
  0x95: 0x2022,
  0x96: 0x2013,
  0x97: 0x2014,
  0x98: 0x02dc,
  0x99: 0x2122,
  0x9a: 0x0161,
  0x9b: 0x203a,
  0x9c: 0x0153,
  0x9e: 0x017e,
  0x9f: 0x0178,
};

export function remapCp1252(text: string): string {
  return text.replace(/[\u0080-\u009f]/g, (ch) =>
    String.fromCodePoint(CP1252[ch.charCodeAt(0)] ?? ch.charCodeAt(0)),
  );
}

/** Checkbox glyph normalization (auditable). */
export const GLYPH_RULES: ReadonlyArray<{ from: RegExp; to: string; note: string }> = [
  { from: /[☐□❏❑¨]/g, to: '☐', note: 'empty box glyphs (incl. Wingdings ¨/o private-use)' },
  { from: /\[\s?\]/g, to: '☐', note: '"[ ]" text box' },
  { from: /[☒☑✓✔]/g, to: '☒', note: 'checked box glyphs' },
  { from: /\[\s?[xX]\s?\]/g, to: '☒', note: '"[X]" text box' },
];

/** EDGAR noise pre-pass rules (auditable; a matching whole line is dropped). */
export const NOISE_RULES: ReadonlyArray<{ id: string; pattern: RegExp }> = [
  {
    id: 'edgar-exhibit-wrapper',
    pattern: /^(EX-\d+[A-Z.()0-9-]*|<?\/?(DOCUMENT|TYPE|SEQUENCE|FILENAME|DESCRIPTION|TEXT)>?.*)$/i,
  },
  { id: 'page-counter-n-of-m', pattern: /^(page\s+)?\d{1,3}\s+of\s+\d{1,3}$/i },
  { id: 'logo-placeholder', pattern: /^\[\s*logo\s*\]$/i },
  { id: 'bare-page-number', pattern: /^(-\s*)?\d{1,3}(\s*-)?$/ },
  { id: 'roman-page-number', pattern: /^[ivxl]{1,6}$/ },
  {
    id: 'page-footer-letter-number',
    pattern: /^[A-Z0-9][A-Z0-9 ,.&()'\u2019-]{2,100}\s[A-Z]-\d{1,2}$/,
  },
];

export const EXCLUSIVITY_CUES: ReadonlyArray<RegExp> = [
  /check only one/i,
  /select only one/i,
  /check one box only/i,
  /\(circle one\)/i,
  /check all that apply/i,
];

export interface NoiseRemoval {
  rule: string;
  text: string;
}

export interface HtmlAdapterResult {
  docHash: string;
  bytes: number;
  lines: Line[];
  noise: NoiseRemoval[];
  adapter_ms: number;
}

interface Frame {
  tag: string;
  /** Weight declaration on this element: true=bold, false=normal, undefined=none. */
  weight?: boolean;
  weightSource?: 'tag' | 'inline_css';
  align?: 'left' | 'center' | 'right';
  indent?: number;
  hasClass: boolean;
  /** Inherited (effective) values, computed once at push so lookups are O(1). */
  effBold: boolean;
  effSource?: 'tag' | 'inline_css';
  effAlign?: 'left' | 'center' | 'right';
  effIndent: number;
  effHasClass: boolean;
}

/** Max tracked element depth; deeper elements are text containers that add no frame (F1 nesting DoS). */
export const MAX_FRAME_DEPTH = 256;
/**
 * Hard cap on total open-element depth. htmlparser2 keeps its own open-element stack with
 * Array#unshift (O(depth) per open), so unbounded nesting is quadratic inside the library.
 * Past this depth the document is rejected (payload_too_large) instead of parsed; real filings
 * nest a few dozen levels, and 16384 keeps the worst-case library cost to tens of ms.
 */
export const MAX_PARSE_DEPTH = 16384;

interface Run {
  text: string;
  bold: boolean;
}

const WEIGHT_RE = /font-weight\s*:\s*([a-z0-9]+)/i;
const FONT_RE = /(?:^|;)\s*font\s*:\s*([^;]*)/i;
const ALIGN_RE = /text-align\s*:\s*(left|center|right|justify)/i;
const INDENT_RE =
  /(?:margin-left|padding-left|text-indent)\s*:\s*(-?\d{1,4}(?:\.\d{1,3})?)\s*(pt|px|in|em)?/i;

/** Parse bold from a style attribute. Exported for tests. */
export function styleWeight(style: string | undefined): boolean | undefined {
  if (!style) return undefined;
  let result: boolean | undefined;
  const font = FONT_RE.exec(style);
  if (font) {
    const v = font[1]!.toLowerCase();
    result = /\b(bold|bolder|[6-9]00)\b/.test(v);
  }
  const w = WEIGHT_RE.exec(style);
  if (w) {
    const v = w[1]!.toLowerCase();
    result = v === 'bold' || v === 'bolder' || /^[6-9]00$/.test(v);
  }
  return result;
}

function toPt(n: number, unit: string | undefined): number {
  switch ((unit ?? 'px').toLowerCase()) {
    case 'pt':
      return n;
    case 'in':
      return n * 72;
    case 'em':
      return n * 12;
    default:
      return n * 0.75;
  }
}

function decodeBytes(input: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8', { fatal: false, ignoreBOM: false }).decode(input);
  if (!utf8.includes('�')) return utf8;
  return new TextDecoder('windows-1252').decode(input);
}

/** Text with the leading number / Part / Appendix prefix removed, up to the first "(". */
export function headingCore(text: string): { start: number; end: number } {
  const prefix =
    /^\s*(?:(?:Part|PART|Appendix|APPENDIX|Section|SECTION)\s+[A-Z0-9]{1,3}\b\s*[.:–—-]?\s*|\(?\d{1,2}[A-Z]?[.)]\s*)?/.exec(
      text,
    );
  const start = prefix ? prefix[0].length : 0;
  const paren = text.indexOf('(', start);
  const end = paren === -1 ? text.length : paren;
  return { start, end };
}

function splitLong(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf(' ', max);
    if (cut <= 0) cut = max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

export function htmlToLines(input: string | Uint8Array): HtmlAdapterResult {
  const t0 = Date.now();
  // UTF-8 byte length >= UTF-16 unit count, so this rejects before allocating the encoded copy.
  if (typeof input === 'string' && input.length > limits.maxHtmlBytes) {
    throw new CoreError('payload_too_large', `HTML input exceeds ${limits.maxHtmlBytes} bytes`);
  }
  const bytesArr = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  if (bytesArr.byteLength > limits.maxHtmlBytes) {
    throw new CoreError('payload_too_large', `HTML input exceeds ${limits.maxHtmlBytes} bytes`);
  }
  const html = typeof input === 'string' ? input : decodeBytes(input);
  const docHash = sha256Hex(bytesArr);

  const stack: Frame[] = [];
  let skipDepth = 0;
  let trDepth = 0;
  let runs: Run[] = [];
  let lineAlign: Frame['align'];
  let lineIndent = 0;
  let lineSource: Cue['cue_source'];
  let lineHasClass = false;
  let lineHasText = false;
  const lines: Line[] = [];
  const noise: NoiseRemoval[] = [];

  /** Count of open non-void elements beyond MAX_FRAME_DEPTH (not tracked as frames). */
  let overflowDepth = 0;
  const top = (): Frame | undefined => stack[stack.length - 1];

  const flush = () => {
    lineHasText = false;
    if (runs.length === 0) return;
    // collapse whitespace across runs, keeping per-char bold (array build: linear time)
    const chars: string[] = [];
    const boldMask: boolean[] = [];
    let lastSpace = true;
    for (const r of runs) {
      for (const ch of r.text) {
        if (
          ch === ' ' ||
          ch === '\t' ||
          ch === '\n' ||
          ch === '\r' ||
          ch === '\f' ||
          /\s/.test(ch)
        ) {
          if (lastSpace) continue;
          chars.push(' ');
          boldMask.push(r.bold);
          lastSpace = true;
        } else {
          chars.push(ch);
          boldMask.push(r.bold);
          lastSpace = false;
        }
      }
    }
    runs = [];
    if (chars.length > 0 && chars[chars.length - 1] === ' ') {
      chars.pop();
      boldMask.pop();
    }
    let text = chars.join('');
    if (!text) return;
    for (const rule of GLYPH_RULES) {
      const re = new RegExp(rule.from.source, 'g');
      let out = '';
      const mask: boolean[] = [];
      let last = 0;
      for (let m = re.exec(text); m; m = re.exec(text)) {
        out += text.slice(last, m.index) + rule.to;
        for (let i = last; i < m.index; i++) mask.push(boldMask[i] ?? false);
        mask.push(boldMask[m.index] ?? false);
        last = m.index + m[0].length;
      }
      if (last === 0) continue;
      out += text.slice(last);
      for (let i = last; i < text.length; i++) mask.push(boldMask[i] ?? false);
      text = out;
      boldMask.length = 0;
      for (const b of mask) boldMask.push(b);
    }
    const noiseRule = NOISE_RULES.find((r) => r.pattern.test(text));
    if (noiseRule) {
      noise.push({ rule: noiseRule.id, text });
      return;
    }
    const core = headingCore(text);
    let letters = 0;
    let boldLetters = 0;
    const scan = (from: number, to: number) => {
      for (let i = from; i < to && i < boldMask.length; i++) {
        const ch = text[i]!;
        if (ch.toLowerCase() === ch.toUpperCase()) continue;
        letters++;
        if (boldMask[i]) boldLetters++;
      }
    };
    scan(core.start, core.end);
    if (letters === 0) {
      letters = 0;
      boldLetters = 0;
      scan(0, text.length);
      if (letters === 0) {
        // digits only: bold if the majority of chars are bold
        const b = boldMask.filter(Boolean).length;
        letters = boldMask.length;
        boldLetters = b;
      }
    }
    const bold = letters > 0 && boldLetters / letters >= 0.6;
    const coreText = text.slice(core.start, core.end).replace(/\*\s*$/, '');
    const cue: Cue = {
      bold,
      caps: isCaps(coreText.trim() ? coreText : text),
      indent: Math.round(lineIndent),
      position: lineAlign ?? 'unknown',
    };
    if (bold && lineSource) cue.cue_source = lineSource;
    else if (!bold && lineHasClass) cue.cue_source = 'class';
    for (const part of splitLong(text, limits.maxLineChars)) {
      lines.push({ text: part, cue: { ...cue } });
    }
    lineAlign = undefined;
    lineIndent = 0;
    lineSource = undefined;
    lineHasClass = false;
  };

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        if (!VOID_TAGS.has(name) && stack.length + overflowDepth + skipDepth >= MAX_PARSE_DEPTH) {
          throw new CoreError(
            'payload_too_large',
            `HTML nesting exceeds ${MAX_PARSE_DEPTH} open elements`,
          );
        }
        if (skipDepth > 0 || SKIP_TAGS.has(name)) {
          if (!VOID_TAGS.has(name)) skipDepth++;
          return;
        }
        if (name === 'br') {
          if (trDepth === 0) flush();
          else runs.push({ text: ' ', bold: false });
          return;
        }
        if (name === 'tr') {
          flush();
          trDepth++;
        } else if ((name === 'td' || name === 'th') && trDepth > 0) {
          runs.push({ text: ' ', bold: false });
        } else if (BLOCK_TAGS.has(name) && trDepth === 0) {
          flush();
        }
        const style = attribs.style;
        const frame: Frame = {
          tag: name,
          hasClass: Boolean(attribs.class),
          effBold: false,
          effIndent: 0,
          effHasClass: false,
        };
        const sw = styleWeight(style);
        if (sw !== undefined) {
          frame.weight = sw;
          frame.weightSource = 'inline_css';
        } else if (name === 'b' || name === 'strong' || name === 'th') {
          frame.weight = true;
          frame.weightSource = 'tag';
        }
        const alignAttr = (attribs.align ?? '').toLowerCase();
        const am = style ? ALIGN_RE.exec(style) : null;
        const align = (am?.[1] ?? alignAttr).toLowerCase();
        if (align === 'center' || align === 'right' || align === 'left') frame.align = align;
        if (name === 'center') frame.align = 'center';
        const im = style ? INDENT_RE.exec(style) : null;
        if (im) frame.indent = toPt(Number(im[1]), im[2]);
        if (VOID_TAGS.has(name)) return;
        if (stack.length >= MAX_FRAME_DEPTH) {
          overflowDepth++;
          return;
        }
        const parent = top();
        if (frame.weight !== undefined) {
          frame.effBold = frame.weight;
          frame.effSource = frame.weightSource;
        } else if (parent) {
          frame.effBold = parent.effBold;
          frame.effSource = parent.effSource;
        }
        frame.effAlign = frame.align ?? parent?.effAlign;
        frame.effIndent = (parent?.effIndent ?? 0) + (frame.indent ?? 0);
        frame.effHasClass = frame.hasClass || (parent?.effHasClass ?? false);
        stack.push(frame);
      },
      ontext(raw) {
        if (skipDepth > 0) return;
        const text = remapCp1252(raw);
        if (!text) return;
        const t = top();
        const bold = t?.effBold ?? false;
        const source = t?.effSource;
        if (!lineHasText) {
          lineAlign = t?.effAlign;
          lineIndent = t?.effIndent ?? 0;
        }
        if (/\S/.test(text)) lineHasText = true;
        if (bold && source && text.trim()) lineSource = lineSource ?? source;
        if (t?.effHasClass) lineHasClass = true;
        runs.push({ text, bold });
      },
      onclosetag(name) {
        if (skipDepth > 0) {
          if (!VOID_TAGS.has(name)) skipDepth--;
          return;
        }
        if (VOID_TAGS.has(name)) return;
        if (overflowDepth > 0) {
          // closes an untracked deep element; no frame to pop
          overflowDepth--;
          return;
        }
        // pop to the matching frame (tolerant of mis-nesting); bounded by MAX_FRAME_DEPTH
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i]!.tag === name) {
            stack.length = i;
            break;
          }
        }
        if (name === 'tr') {
          flush();
          trDepth = Math.max(0, trDepth - 1);
        } else if (BLOCK_TAGS.has(name) && trDepth === 0) {
          flush();
        }
      },
    },
    { decodeEntities: true, lowerCaseTags: true, lowerCaseAttributeNames: true },
  );
  parser.write(html);
  parser.end();
  flush();
  // repeating running headers: a short bold/caps line seen before is dropped (first occurrence kept)
  const seen = new Set<string>();
  const kept: Line[] = [];
  for (const line of lines) {
    const key = line.text.toLowerCase();
    if (
      line.text.length <= 80 &&
      (line.cue.caps ||
        (line.cue.bold &&
          /signature pages|terms (and|&) conditions|instructions|appendix/i.test(line.text))) &&
      !/^\s*(\d|part\s|\u2610|\u2612)/i.test(line.text)
    ) {
      if (seen.has(key)) {
        noise.push({ rule: 'repeating-header', text: line.text });
        continue;
      }
      seen.add(key);
    }
    kept.push(line);
  }
  return { docHash, bytes: bytesArr.byteLength, lines: kept, noise, adapter_ms: Date.now() - t0 };
}
