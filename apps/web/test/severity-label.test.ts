// @vitest-environment node
import { SEVERITIES } from '@aduin/core';
import { describe, expect, it } from 'vitest';
import { SEV, sevKey } from '../src/features/review/severity';
import { DISMISS_REASONS } from '../src/features/review/reasons';
import { reasonsList, sevTable } from './support/mockupCss';

describe('severity-label', () => {
  it('maps critical/high/medium/low to block/fix/note', () => {
    expect(SEVERITIES.map(sevKey)).toEqual(['block', 'fix', 'note', 'note']);
  });
  it('uses exactly the app.html SEV labels', () => {
    const mock = sevTable();
    expect(Object.keys(mock)).toEqual(['block', 'fix', 'note']);
    for (const k of ['block', 'fix', 'note'] as const) {
      expect(SEV[k].label).toBe(mock[k]!.label);
      expect(SEV[k].short).toBe(mock[k]!.short);
    }
    expect(SEV.block.label).toBe('Blocks digitization');
    expect(SEV.fix.label).toBe('Fix before build');
  });
  it('maps the 4 app.html dismiss reasons to the DATA-MODEL reason codes', () => {
    expect(DISMISS_REASONS.map((r) => r.label)).toEqual(reasonsList());
    expect(DISMISS_REASONS.map((r) => r.code)).toEqual([
      'firm_standard_wording',
      'no_form_impact',
      'tool_false_alarm',
      'other',
    ]);
  });
});
