/**
 * fixtures:check (Phase 02 drift gate): rebuild every generated fixture in memory and compare it
 * byte-for-byte with the committed file. Also fails on stray files in generated seeded dirs.
 * Exit 1 on any drift, missing or stray file.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildFixtures, SEEDED_DIR } from './build-seeded';
import { ROOT } from './find-shared-passages';
import { buildDocxFixtures, DOCX_DIR, sameDocx } from './make-docx';
import { buildPdfFixtures, PDF_CROP, PDF_DIR } from './make-pdf';
import { OcrResultSchema } from '@aduin/core';
import {
  OCR_PRECOMPUTED_DIR,
  ocrPageKey,
  readPrecomputed,
  strayPrecomputed,
} from '../precompute/precompute-ocr';
import { scanPages } from '../samples/scan-set';

const fresh = buildFixtures();
const problems: string[] = [];
for (const [rel, content] of fresh) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) problems.push(`missing: ${rel}`);
  else if (readFileSync(abs, 'utf8') !== content) problems.push(`drift: ${rel}`);
}
const seededRoot = join(ROOT, SEEDED_DIR);
if (existsSync(seededRoot)) {
  for (const dir of readdirSync(seededRoot)) {
    if (!statSync(join(seededRoot, dir)).isDirectory()) continue;
    for (const f of readdirSync(join(seededRoot, dir))) {
      const rel = `${SEEDED_DIR}/${dir}/${f}`;
      if (!fresh.has(rel)) problems.push(`stray: ${rel}`);
    }
  }
}
// Phase 06 DOCX fixtures: entry-level compare (docx stamps a creation time into core.xml).
const freshDocx = await buildDocxFixtures();
for (const [rel, content] of freshDocx) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) problems.push(`missing: ${rel}`);
  else if (!sameDocx(readFileSync(abs), content)) problems.push(`drift: ${rel}`);
}
for (const f of readdirSync(join(ROOT, DOCX_DIR))) {
  if (f !== '.gitkeep' && !freshDocx.has(`${DOCX_DIR}/${f}`))
    problems.push(`stray: ${DOCX_DIR}/${f}`);
}
// Phase 06 PDF fixtures: byte-exact compare (make-pdf output is deterministic).
const freshPdf = buildPdfFixtures(ROOT);
for (const [rel, content] of freshPdf) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) problems.push(`missing: ${rel}`);
  else if (!Buffer.from(content).equals(readFileSync(abs))) problems.push(`drift: ${rel}`);
}
for (const f of readdirSync(join(ROOT, PDF_DIR))) {
  const rel = `${PDF_DIR}/${f}`;
  if (f === 'src') {
    for (const g of readdirSync(join(ROOT, rel)))
      if (`${rel}/${g}` !== PDF_CROP) problems.push(`stray: ${rel}/${g}`);
  } else if (!freshPdf.has(rel)) problems.push(`stray: ${rel}`);
}
// Phase 06f: scan ground truth, OCR recordings, shipped precomputed OCR (integrity only).
let ocrFiles = 0;
const GT = join(ROOT, 'fixtures', 'scans-ground-truth');
const rawPages = new Set(scanPages().map((p) => p.raw.replace(/\.jpg$/, '')));
if (
  !existsSync(join(GT, 'README.md')) ||
  !/agent-transcribed, human spot-check recommended/i.test(
    readFileSync(join(GT, 'README.md'), 'utf8'),
  )
)
  problems.push('missing: fixtures/scans-ground-truth/README.md label');
const gtFiles = readdirSync(GT).filter((f) => f !== 'README.md' && !f.startsWith('.'));
if (gtFiles.length < 3 || gtFiles.length > 5)
  problems.push(`ground truth: expected 3-5 pages, found ${gtFiles.length}`);
for (const f of gtFiles) {
  ocrFiles++;
  if (!f.endsWith('.txt') || !rawPages.has(f.slice(0, -4)))
    problems.push(`stray: fixtures/scans-ground-truth/${f}`);
  else if (readFileSync(join(GT, f), 'utf8').trim().length === 0)
    problems.push(`empty: fixtures/scans-ground-truth/${f}`);
}
const KEYLIKE = new RegExp(['sk', 'or', ''].join('-') + '|Bearer ');
const REC = join(ROOT, 'fixtures', 'llm-recordings', 'ocr');
for (const f of existsSync(REC) ? readdirSync(REC) : []) {
  ocrFiles++;
  const text = readFileSync(join(REC, f), 'utf8');
  if (KEYLIKE.test(text)) problems.push(`secret-like text: fixtures/llm-recordings/ocr/${f}`);
  try {
    const j = JSON.parse(text) as { result?: unknown };
    if (!OcrResultSchema.safeParse(j.result).success) problems.push(`invalid OCR result: ${f}`);
  } catch {
    problems.push(`invalid JSON: fixtures/llm-recordings/ocr/${f}`);
  }
}
if (existsSync(join(OCR_PRECOMPUTED_DIR, 'index.json'))) {
  const idx = JSON.parse(readFileSync(join(OCR_PRECOMPUTED_DIR, 'index.json'), 'utf8')) as Record<
    string,
    { page: number; file: string; key: string }[]
  >;
  const byN = new Map(scanPages().map((p) => [p.n, p] as const));
  for (const e of idx['09'] ?? []) {
    ocrFiles++;
    const p = byN.get(e.page);
    if (
      !p ||
      e.key !== ocrPageKey(p.sourceHash, p.n - 1) ||
      !readPrecomputed(OCR_PRECOMPUTED_DIR, e.key)
    )
      problems.push(`precomputed OCR: bad index entry for page ${e.page}`);
    if (KEYLIKE.test(readFileSync(join(OCR_PRECOMPUTED_DIR, e.file), 'utf8')))
      problems.push(`secret-like text: ${e.file}`);
  }
  for (const f of strayPrecomputed()) problems.push(`stray: apps/web/public/precomputed/ocr/${f}`);
}
if (problems.length) {
  console.error(`fixtures:check FAILED (${problems.length})`);
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    'Run: pnpm --filter @aduin/scripts fixtures:build (DOCX: tsx src/fixtures/make-docx.ts; PDF: tsx src/fixtures/make-pdf.ts)',
  );
  process.exit(1);
}
console.log(
  `fixtures:check OK (${fresh.size + freshDocx.size + freshPdf.size} files match a fresh build; ${ocrFiles} OCR/ground-truth files valid)`,
);
