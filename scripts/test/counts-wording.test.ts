import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectors, ISSUE_CLASSES } from '@aduin/core';
import { ROOT } from '../src/live/common';

// Variance Phase 05 (E2, counts wording): the product keeps exactly 13 deterministic detectors and
// 15 issue classes, and the design-owned docs (read-only here) still say so. A changed count is a
// defect routed back to the engine phase, never a doc edit in this phase.
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('counts-wording', () => {
  it('should keep exactly 13 detectors and 15 issue classes with the wording present', () => {
    expect(detectors).toHaveLength(13);
    expect(new Set(detectors.map((d) => d.id)).size).toBe(13);
    expect(ISSUE_CLASSES).toHaveLength(15);
    expect(new Set(ISSUE_CLASSES).size).toBe(15);

    const readme = read('README.md');
    expect(readme).toMatch(/13 deterministic detectors|13 detectors/);
    expect(readme).toContain('15 issue classes');
    expect(read('docs/architecture/status.md')).toMatch(/13 deterministic detectors|13 detectors/);
    expect(read('docs/architecture/components.md')).toContain('15 issue classes');
  });
});
