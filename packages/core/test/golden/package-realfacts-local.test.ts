import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { htmlToLines } from '../../src/adapters/html';
import { buildPackageFacts } from '../../src/package/index';
import { PKG, REPO } from '../helpers/package-fixtures';

/**
 * Hybrid, opt-in (PACKAGE_LOCAL=1): re-derive facts from the local real files and compare with the
 * committed real facts. Skipped silently otherwise; never a CI gate.
 */
const ON =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[
    'PACKAGE_LOCAL'
  ] === '1';
const LOCAL: Record<string, string> = {
  'sec-09-s11a-full':
    'samples/sub-docs/raw/_full-prospectus/09-rw-holdings-reit-s11a-2019-full.htm',
  'sec-13-s11-full': 'samples/sub-docs/raw/_full-prospectus/13-blackstone-reit-s11-2024-full.htm',
  'sample-13-appendix-b': 'samples/sub-docs/raw/13-blackstone-reit-2024-appendix-b.htm',
};

describe.skipIf(!ON)('package-realfacts-local (Hybrid)', () => {
  const files = readdirSync(`${PKG}real-facts`).filter((f) => LOCAL[f.replace(/\.json$/, '')]);
  it.each(files)('%s matches the local file', (f) => {
    const j = JSON.parse(readFileSync(`${PKG}real-facts/${f}`, 'utf8'));
    const path = REPO + LOCAL[j.id]!;
    expect(existsSync(path), `local file missing: ${LOCAL[j.id]}`).toBe(true);
    const r = htmlToLines(new Uint8Array(readFileSync(path)));
    const facts = buildPackageFacts({
      contentHash: r.docHash,
      name: j.name,
      format: 'html',
      bytes: r.bytes,
      lines: r.lines,
    });
    expect(facts.titleLines).toEqual(j.titleLines);
    expect(facts.headText).toEqual(j.headText);
  });
});
