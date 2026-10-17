/**
 * package:facts-extract (intake Phase 1, local-only): derives short committed "real facts" for
 * documents that are too large or gitignored (full S-11 prospectus files), plus #13 Appendix B
 * and the #9 precomputed OCR page 1, so detection goldens run in CI without them.
 * Writes fixtures/package/real-facts/<id>.json (titleLines <= 12 x 200, headText <= 1500).
 * Real public documents are untrusted input: parse only.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPackageFacts,
  htmlToLines,
  ocrToLines,
  OcrResultSchema,
  type Line,
  type PackageDocFormat,
  type PackageDocRole,
  type PackageDocType,
} from '@aduin/core';
import { ROOT } from './find-shared-passages';

export const REAL_FACTS_DIR = 'fixtures/package/real-facts';

export interface RealFactsSource {
  id: string;
  name: string;
  path: string;
  format: PackageDocFormat;
  expectedType: PackageDocType;
  expectedRole: PackageDocRole;
}

const RAW = 'samples/sub-docs/raw';
export const REAL_FACTS_SOURCES: readonly RealFactsSource[] = [
  {
    id: 'sec-09-s11a-full',
    name: '09-rw-holdings-reit-s11a-2019-full.htm',
    path: `${RAW}/_full-prospectus/09-rw-holdings-reit-s11a-2019-full.htm`,
    format: 'html',
    expectedType: 'ppm',
    expectedRole: 'reference',
  },
  {
    id: 'sec-13-s11-full',
    name: '13-blackstone-reit-s11-2024-full.htm',
    path: `${RAW}/_full-prospectus/13-blackstone-reit-s11-2024-full.htm`,
    format: 'html',
    expectedType: 'ppm',
    expectedRole: 'reference',
  },
  {
    id: 'sample-13-appendix-b',
    name: '13-blackstone-reit-2024-appendix-b.htm',
    path: `${RAW}/13-blackstone-reit-2024-appendix-b.htm`,
    format: 'html',
    expectedType: 'sub_agreement',
    expectedRole: 'to_digitize',
  },
  {
    id: 'scan-09-page-1',
    name: '09-rw-holdings-scan-page-01.jpg',
    path: 'apps/web/public/precomputed/ocr/index.json',
    format: 'ocr',
    expectedType: 'sub_agreement',
    expectedRole: 'to_digitize',
  },
];

function linesOf(src: RealFactsSource): { lines: Line[]; hash: string; bytes: number } | null {
  const abs = join(ROOT, src.path);
  if (!existsSync(abs)) return null;
  if (src.format === 'ocr') {
    const idx = JSON.parse(readFileSync(abs, 'utf8')) as Record<
      string,
      { page: number; file: string }[]
    >;
    const e = (idx['09'] ?? []).find((x) => x.page === 1);
    if (!e) return null;
    const j = JSON.parse(
      readFileSync(join(ROOT, 'apps/web/public/precomputed/ocr', e.file), 'utf8'),
    ) as {
      result: unknown;
      key: string;
    };
    const r = ocrToLines(OcrResultSchema.parse(j.result));
    return { lines: r.lines, hash: j.key, bytes: 0 };
  }
  const r = htmlToLines(new Uint8Array(readFileSync(abs)));
  return { lines: r.lines, hash: r.docHash, bytes: r.bytes };
}

export function realFacts(src: RealFactsSource): string | null {
  const l = linesOf(src);
  if (!l) return null;
  const f = buildPackageFacts({
    contentHash: l.hash,
    name: src.name,
    format: src.format,
    bytes: l.bytes,
    lines: l.lines,
  });
  const out = {
    id: src.id,
    name: src.name,
    format: src.format,
    titleLines: f.titleLines,
    headText: f.headText,
    expectedType: src.expectedType,
    expectedRole: src.expectedRole,
  };
  return JSON.stringify(out, null, 2) + '\n';
}

function main(): void {
  mkdirSync(join(ROOT, REAL_FACTS_DIR), { recursive: true });
  for (const src of REAL_FACTS_SOURCES) {
    const j = realFacts(src);
    if (!j) {
      console.log(
        `missing local file for ${src.id}: ${src.path} (Known-Gap; keep committed facts)`,
      );
      continue;
    }
    writeFileSync(join(ROOT, REAL_FACTS_DIR, `${src.id}.json`), j);
    console.log(`wrote ${REAL_FACTS_DIR}/${src.id}.json`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
