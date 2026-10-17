import { limits } from '../config/limits';
import { CoreError } from '../model/errors';

/**
 * Upload format detection (Phase 06 D3): extension AND magic bytes must agree.
 * Accepted: .htm/.html (no binary magic), .pdf (%PDF-), .docx (ZIP with word/document.xml and
 * [Content_Types].xml), .jpg/.jpeg (FF D8 FF), .png (89 50 4E 47 0D 0A 1A 0A).
 * Rejected with a clear CoreError: empty, oversize, unknown extension (incl. SVG), content that
 * does not match the extension, and polyglots (a file that is valid as two formats at once,
 * e.g. a JPEG or PDF with an embedded Word package). Pure, no DOM, runs anywhere.
 */

export type DocFormat = 'html' | 'pdf' | 'docx' | 'jpeg' | 'png';

export interface FormatDetection {
  format: DocFormat;
  /** Lower-case extension including the dot, e.g. ".pdf". */
  extension: string;
  /** True for formats that go through OCR as page images. */
  image: boolean;
}

/** Trailing extension of a file name (bounded). */
export const EXTENSION_RE = /\.([a-z0-9]{1,10})$/i;

const EXT_FORMAT: Record<string, DocFormat> = {
  '.htm': 'html',
  '.html': 'html',
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.png': 'png',
};

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // PK\3\4
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const DOCX_MAIN = ascii('word/document.xml');
const DOCX_TYPES = ascii('[Content_Types].xml');

const LABEL: Record<DocFormat, string> = {
  html: 'an HTML file',
  pdf: 'a PDF',
  docx: 'a Word (.docx) file',
  jpeg: 'a JPEG image',
  png: 'a PNG image',
};

function startsWith(b: Uint8Array, magic: readonly number[], at = 0): boolean {
  if (b.byteLength < at + magic.length) return false;
  for (let i = 0; i < magic.length; i++) if (b[at + i] !== magic[i]) return false;
  return true;
}

/** Linear byte search (first occurrence at or after `from`), -1 when absent. */
export function indexOfBytes(b: Uint8Array, needle: readonly number[], from = 0): number {
  const first = needle[0];
  const last = b.byteLength - needle.length;
  outer: for (let i = Math.max(0, from); i <= last; i++) {
    if (b[i] !== first) continue;
    for (let j = 1; j < needle.length; j++) if (b[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

/** A Word package: a ZIP local header and both OOXML part names. */
function hasDocxPackage(b: Uint8Array): boolean {
  return (
    indexOfBytes(b, ZIP_MAGIC) >= 0 &&
    indexOfBytes(b, DOCX_MAIN) >= 0 &&
    indexOfBytes(b, DOCX_TYPES) >= 0
  );
}

/** Format implied by the leading magic bytes, or 'html'-candidate (null) when none matches. */
export function sniffMagic(b: Uint8Array): Exclude<DocFormat, 'html'> | null {
  if (startsWith(b, PDF_MAGIC)) return 'pdf';
  if (startsWith(b, PNG_MAGIC)) return 'png';
  if (startsWith(b, JPEG_MAGIC)) return 'jpeg';
  if (startsWith(b, ZIP_MAGIC)) return hasDocxPackage(b) ? 'docx' : null;
  return null;
}

/** HTML must look like text: no NUL byte in the first 4 KB and no binary magic anywhere at start. */
function looksLikeText(b: Uint8Array): boolean {
  const n = Math.min(b.byteLength, 4096);
  for (let i = 0; i < n; i++) if (b[i] === 0) return false;
  return !startsWith(b, ZIP_MAGIC);
}

/**
 * Detect and validate an upload. Throws CoreError:
 *  - `invalid_request` for an empty file
 *  - `payload_too_large` above limits.maxUploadBytes
 *  - `unsupported_type` for an unknown extension, an extension/content mismatch or a polyglot
 */
export function detectFormat(fileName: string, bytes: Uint8Array): FormatDetection {
  const m = EXTENSION_RE.exec(fileName.slice(-32));
  const extension = m ? `.${m[1]!.toLowerCase()}` : '';
  const expected = EXT_FORMAT[extension];
  if (!expected) {
    throw new CoreError(
      'unsupported_type',
      `Unsupported file type${extension ? ` "${extension}"` : ''}. Use HTML, PDF, Word (.docx), JPEG or PNG.`,
    );
  }
  if (bytes.byteLength === 0) throw new CoreError('invalid_request', 'The file is empty.');
  if (bytes.byteLength > limits.maxUploadBytes) {
    throw new CoreError(
      'payload_too_large',
      `The file is larger than ${limits.maxUploadBytes / (1024 * 1024)} MB.`,
    );
  }

  const sniffed = sniffMagic(bytes);
  const actual: DocFormat | null = sniffed ?? (looksLikeText(bytes) ? 'html' : null);
  if (actual !== expected) {
    throw new CoreError(
      'unsupported_type',
      `The file content is not ${LABEL[expected]} (it does not match the "${extension}" extension).`,
    );
  }
  // Polyglot: a PDF or image that also carries a Word package (or a docx with a PDF header
  // inside its first bytes is impossible since ZIP magic is at 0). Reject rather than guess.
  if ((actual === 'pdf' || actual === 'jpeg' || actual === 'png') && hasDocxPackage(bytes)) {
    throw new CoreError(
      'unsupported_type',
      `The file is ${LABEL[actual]} that also contains a Word package; mixed files are not accepted.`,
    );
  }
  if (actual === 'html' && indexOfBytes(bytes.subarray(0, 1024), PDF_MAGIC) >= 0) {
    throw new CoreError(
      'unsupported_type',
      'The file looks like a PDF saved with an HTML extension; mixed files are not accepted.',
    );
  }
  return { format: actual, extension, image: actual === 'jpeg' || actual === 'png' };
}
