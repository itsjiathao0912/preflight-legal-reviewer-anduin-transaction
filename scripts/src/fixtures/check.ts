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
if (problems.length) {
  console.error(`fixtures:check FAILED (${problems.length})`);
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    'Run: pnpm --filter @aduin/scripts fixtures:build (DOCX: tsx src/fixtures/make-docx.ts; PDF: tsx src/fixtures/make-pdf.ts)',
  );
  process.exit(1);
}
console.log(
  `fixtures:check OK (${fresh.size + freshDocx.size + freshPdf.size} files match a fresh build)`,
);
