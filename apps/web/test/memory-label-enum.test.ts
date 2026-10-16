// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MEMORY_LABELS } from '@aduin/core';
import { describe, expect, it } from 'vitest';
import { memoryLabelText } from '../src/features/review/memory-labels';
import { REPO_ROOT } from './support/mockupCss';

const DATA_MODEL = resolve(
  REPO_ROOT,
  'process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_DATA-MODEL_17-10-26.md',
);

describe('memory-label-enum', () => {
  it('core MemoryLabel values equal the DATA-MODEL memory_label CHECK list', () => {
    const md = readFileSync(DATA_MODEL, 'utf8');
    const row = md.split('\n').find((l) => /\|\s*memory_label\s*\|/.test(l) && /CHECK IN/.test(l));
    expect(row, 'memory_label CHECK row').toBeTruthy();
    const list = [...row!.match(/CHECK IN \(([^)]*)\)/)![1]!.matchAll(/'([a-z_]+)'/g)].map(
      (m) => m[1],
    );
    expect([...MEMORY_LABELS].sort()).toEqual([...list].sort());
  });
  it('every label has display text', () => {
    for (const l of MEMORY_LABELS) expect(memoryLabelText(l, 'Fund A').length).toBeGreaterThan(2);
    expect(memoryLabelText('dismissed_reconfirm', 'Master Fund 2019')).toBe(
      'Dismissed in Master Fund 2019, re-confirm',
    );
  });
});
