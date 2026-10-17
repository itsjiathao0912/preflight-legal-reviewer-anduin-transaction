import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LAW_FIRMS } from '@aduin/core';
import { buildReferenceSql, REFERENCE_0003_FIRM_IDS, ROOT } from '../src/seed/gen-demo-seed';

// Variance Phase 03 (F2): firms added after migration 0003 must not change the regenerated 0003
// (it is never edited after remote apply); each such firm is inserted by a later migration.
const MIGRATIONS = resolve(ROOT, 'apps/worker/migrations');

describe('reference firms pin (0003 byte identity with a longer firm list)', () => {
  it('the pinned 0003 list stays the original three firms', () => {
    expect([...REFERENCE_0003_FIRM_IDS]).toEqual(['partners-group', 'firm-x', 'firm-y']);
  });

  it('regenerated 0003 equals the landed file and holds none of the later firms', () => {
    const landed = readFileSync(resolve(MIGRATIONS, '0003_reference_seed.sql'), 'utf8');
    const built = buildReferenceSql();
    expect(landed.trimEnd()).toBe(built.trimEnd());
    for (const id of ['hartwell-crane', 'ostrander-pell', 'calder-reyes'])
      expect(built).not.toContain(id);
  });

  it('every LAW_FIRMS entry is pinned to 0003 or inserted by a later migration', () => {
    const later = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith('.sql') && f > '0003')
      .map((f) => readFileSync(resolve(MIGRATIONS, f), 'utf8'))
      .join('\n');
    for (const f of LAW_FIRMS) {
      if (REFERENCE_0003_FIRM_IDS.includes(f.id)) continue;
      expect(later, f.id).toMatch(
        new RegExp(
          `INSERT OR IGNORE INTO law_firm \\(id, canonical_name, name_norm\\) VALUES \\('${f.id}'`,
        ),
      );
    }
    expect(LAW_FIRMS.some((f) => f.id === 'sutter-lane')).toBe(false);
  });
});
