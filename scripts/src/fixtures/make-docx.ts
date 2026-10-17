/**
 * DOCX fixtures (Phase 06, D6): writes fixtures/docx/
 *  - legal-numbering.docx  synthetic sub-doc with Word list numbering 1. / 1.1 / (a) / (i) and
 *                          cross-references ("see Section 2(b)"); built with `docx` (MIT)
 *  - corrupt.docx          a truncated zip (one local file header, no central directory)
 *  - empty.docx            0 bytes
 * Run: `pnpm --filter @aduin/scripts exec tsx src/fixtures/make-docx.ts` (also invoked by fixtures:check
 * in compare mode). `docx` stamps the current time into docProps/core.xml, so the drift check
 * compares zip ENTRIES (name + inflated content), skipping docProps/core.xml.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { ROOT } from './find-shared-passages';

export const DOCX_DIR = 'fixtures/docx';

const LEGAL_LEVELS = [
  { level: 0, format: LevelFormat.DECIMAL, text: '%1.' },
  { level: 1, format: LevelFormat.DECIMAL, text: '%1.%2' },
  { level: 2, format: LevelFormat.LOWER_LETTER, text: '(%3)' },
  { level: 3, format: LevelFormat.LOWER_ROMAN, text: '(%4)' },
].map((l) => ({ ...l, alignment: AlignmentType.START }));

const item = (text: string, level: number) =>
  new Paragraph({ text, numbering: { reference: 'legal', level } });

export async function legalNumberingDocx(): Promise<Buffer> {
  const doc = new Document({
    creator: 'aduin-transaction fixtures',
    title: 'Synthetic Subscription Agreement',
    numbering: { config: [{ reference: 'legal', levels: LEGAL_LEVELS }] },
    sections: [
      {
        children: [
          new Paragraph({ text: 'SUBSCRIPTION AGREEMENT', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: 'Synthetic Fund I, L.P.', heading: HeadingLevel.HEADING_2 }),
          item('Definitions and Interpretation', 0),
          item('Capitalized terms have the meanings given in the Partnership Agreement.', 1),
          item('References to Sections are to Sections of this Agreement.', 1),
          item('Subscription', 0),
          item('The Subscriber subscribes for the Commitment set out in Section 4.', 1),
          item('The Subscriber represents that it is:', 1),
          item('an accredited investor, see Section 2(b) of the Investor Questionnaire;', 2),
          item('a qualified purchaser, see Section 3.2;', 2),
          item('a natural person who holds the investment directly;', 3),
          item('an entity acting through an authorized signatory.', 3),
          item('Representations of the Subscriber', 0),
          item('The Subscriber has read Section 2.2(a) and Section 9.', 1),
          item('Commitment', 0),
          item(
            'If the Subscriber is an entity, complete Section 3.1; otherwise skip to Section 5.',
            1,
          ),
          new Paragraph({
            children: [new TextRun({ text: 'Signature page follows.', bold: true })],
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

/** Deterministic truncated zip: a local header for word/document.xml and then nothing. */
const CORRUPT = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.alloc(22),
  Buffer.from([17, 0, 0, 0]),
  Buffer.from('word/document.xml<w:document', 'latin1'),
]);

/** Every committed DOCX fixture, in memory. */
export async function buildDocxFixtures(): Promise<Map<string, Buffer>> {
  const legal = await legalNumberingDocx();
  return new Map<string, Buffer>([
    [`${DOCX_DIR}/legal-numbering.docx`, legal],
    [`${DOCX_DIR}/corrupt.docx`, CORRUPT],
    [`${DOCX_DIR}/empty.docx`, Buffer.alloc(0)],
  ]);
}

/** Zip entries -> name: inflated content, for a timestamp-independent comparison. */
export function zipEntries(b: Buffer): Map<string, Buffer> | null {
  const eocd = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0 || b.length < 22) return null;
  const count = b.readUInt16LE(eocd + 10);
  let p = b.readUInt32LE(eocd + 16);
  const out = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    if (b.readUInt32LE(p) !== 0x02014b50) return null;
    const method = b.readUInt16LE(p + 10);
    const size = b.readUInt32LE(p + 20);
    const nameLen = b.readUInt16LE(p + 28);
    const skip = b.readUInt16LE(p + 30) + b.readUInt16LE(p + 32);
    const lo = b.readUInt32LE(p + 42);
    const name = b.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    const start = lo + 30 + b.readUInt16LE(lo + 26) + b.readUInt16LE(lo + 28);
    const data = b.subarray(start, start + size);
    out.set(name, method === 8 ? inflateRawSync(data) : Buffer.from(data));
    p += 46 + nameLen + skip;
  }
  return out;
}

const VOLATILE = new Set(['docProps/core.xml']);

/** True when two DOCX/zip buffers carry the same content (ignoring the creation timestamp). */
export function sameDocx(a: Buffer, b: Buffer): boolean {
  const ea = zipEntries(a);
  const eb = zipEntries(b);
  if (!ea || !eb) return a.equals(b);
  const keys = [...ea.keys()].filter((k) => !VOLATILE.has(k));
  if (keys.length !== [...eb.keys()].filter((k) => !VOLATILE.has(k)).length) return false;
  return keys.every((k) => eb.has(k) && ea.get(k)!.equals(eb.get(k)!));
}

async function main(): Promise<void> {
  for (const [rel, content] of await buildDocxFixtures()) {
    const abs = join(ROOT, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
    console.log(`wrote ${rel} (${content.length} bytes)`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
