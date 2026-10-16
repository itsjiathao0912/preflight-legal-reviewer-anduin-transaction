/**
 * fixtures:check (Phase 02 drift gate): rebuild every generated fixture in memory and compare it
 * byte-for-byte with the committed file. Also fails on stray files in generated seeded dirs.
 * Exit 1 on any drift, missing or stray file.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildFixtures, SEEDED_DIR } from './build-seeded';
import { ROOT } from './find-shared-passages';

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
if (problems.length) {
  console.error(`fixtures:check FAILED (${problems.length})`);
  for (const p of problems) console.error(`  ${p}`);
  console.error('Run: pnpm --filter @aduin/scripts fixtures:build');
  process.exit(1);
}
console.log(`fixtures:check OK (${fresh.size} files match a fresh build)`);
