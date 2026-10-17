import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../src/fixtures/find-shared-passages';
import { sameDocx } from '../src/fixtures/make-docx';
import { buildPackageFixtures, DESIGN_PACKAGES, HARTWELL_DIR } from '../src/fixtures/make-package';

describe('package-fixtures (intake Phase 1)', () => {
  it('generated package fixtures equal the committed files (docx without docProps/core.xml)', async () => {
    const fresh = await buildPackageFixtures();
    expect(fresh.size).toBeGreaterThan(10);
    for (const [rel, content] of fresh) {
      const abs = join(ROOT, rel);
      expect(existsSync(abs), rel).toBe(true);
      if (typeof content === 'string') expect(readFileSync(abs, 'utf8'), rel).toBe(content);
      else if (rel.startsWith(HARTWELL_DIR))
        expect(sameDocx(readFileSync(abs), content), rel).toBe(true);
      else expect(content.equals(readFileSync(abs)), rel).toBe(true);
    }
  });

  it('design copies are byte copies of the read-only samples/packages sources', async () => {
    const sums = JSON.parse(
      readFileSync(join(ROOT, 'fixtures/package/design/checksums.json'), 'utf8'),
    ) as Record<string, { source: string; sha256: string }>;
    expect(Object.keys(sums).length).toBe(18);
    for (const [rel, v] of Object.entries(sums))
      expect(readFileSync(join(ROOT, v.source)).equals(readFileSync(join(ROOT, rel))), rel).toBe(
        true,
      );
    expect(DESIGN_PACKAGES.map((d) => d.id)).toEqual([
      'northgate-iii',
      'lotus-bay-asia-ii',
      'redwood-ridge-i',
    ]);
  });

  it('demo-packages lists the design packages first and primaryDemoId northgate-iii', () => {
    const j = JSON.parse(readFileSync(join(ROOT, 'fixtures/package/demo-packages.json'), 'utf8'));
    expect(j.primaryDemoId).toBe('northgate-iii');
    expect(j.packages.map((p: { id: string }) => p.id)).toEqual([
      'northgate-iii',
      'lotus-bay-asia-ii',
      'redwood-ridge-i',
      'hartwell',
      'ngi',
      'rw-scans',
      'blackstone-appendix',
    ]);
  });

  it('hartwell HTML lines are at most 100 chars', async () => {
    const fresh = await buildPackageFixtures();
    for (const [rel, c] of fresh)
      if (rel.endsWith('.html'))
        for (const l of String(c).split('\n')) expect(l.length, rel).toBeLessThanOrEqual(100);
  });
});
