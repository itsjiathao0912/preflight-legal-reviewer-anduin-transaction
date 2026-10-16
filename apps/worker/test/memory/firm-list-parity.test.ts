// AC41: the D1 firm list and aliases equal fixtures/memory/law-firms.json via core normalizeFirmAlias.
import { env } from 'cloudflare:test';
import { ISSUE_CLASSES, LAW_FIRMS, normalizeFirmAlias } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import firms from '../../../../fixtures/memory/law-firms.json' with { type: 'json' };

describe('firm-list-parity (AC41)', () => {
  test('law_firm rows equal the fixture firms', async () => {
    const r = await env.DB.prepare(
      'SELECT id, canonical_name, name_norm FROM law_firm ORDER BY id',
    ).all();
    const want = firms.firms
      .map((f) => ({ id: f.id, canonical_name: f.name, name_norm: normalizeFirmAlias(f.name) }))
      .sort((a, b) => a.id.localeCompare(b.id));
    expect(r.results).toEqual(want);
    expect(LAW_FIRMS.map((f) => f.id).sort()).toEqual(want.map((f) => f.id));
  });

  test('aliases equal normalizeFirmAlias over id, name and aliases', async () => {
    const r = await env.DB.prepare(
      'SELECT alias_norm, law_firm_id FROM law_firm_alias ORDER BY alias_norm',
    ).all();
    const want = firms.firms
      .flatMap((f) =>
        [...new Set([f.id, f.name, ...f.aliases].map(normalizeFirmAlias))]
          .filter(Boolean)
          .map((a) => ({ alias_norm: a, law_firm_id: f.id })),
      )
      .sort((a, b) => a.alias_norm.localeCompare(b.alias_norm));
    expect(r.results).toEqual(want);
  });

  test('issue_class rows equal core ISSUE_CLASSES in order', async () => {
    const r = await env.DB.prepare('SELECT code FROM issue_class ORDER BY sort').all<{
      code: string;
    }>();
    expect(r.results.map((x) => x.code)).toEqual([...ISSUE_CLASSES]);
  });
});
