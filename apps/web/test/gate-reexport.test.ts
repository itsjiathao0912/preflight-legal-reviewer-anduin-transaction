// @vitest-environment node
import * as core from '@aduin/core';
import { describe, expect, it } from 'vitest';
import * as interim from '../src/features/review/gateInterim';
import { rulesEchoMismatch, rulesHashMissing } from '../src/features/ai/ai-lane';

describe('gate re-export compatibility', () => {
  it('gateInterim.ts re-exports the core gate under its Phase 03 names (E13)', () => {
    expect(interim.gateInterim).toBe(core.computeGate);
    expect(interim.GATE_REASON_TEXT).toBe(core.GATE_REASON_TEXT);
    expect(Object.keys(interim).sort()).toEqual(['GATE_REASON_TEXT', 'gateInterim']);
  });
  it('keeps the Phase 03 call shape ({id, severity} without detector_kind)', () => {
    expect(
      interim.gateInterim([{ id: 'f1', severity: 'critical' }], { f1: { status: 'accepted' } }, {}),
    ).toEqual({
      status: 'blocked',
      reasons: [{ findingKey: 'f1', kind: 'unanswered', link: '#findings/f1' }],
    });
  });
  it('excludes AI-detector findings from the gate (L4)', () => {
    expect(
      interim.gateInterim([{ id: 'f1', severity: 'critical', detector_kind: 'ai' }], {}, {}).status,
    ).toBe('ready');
  });
});

describe('rules echo (L5 client)', () => {
  it('flags a mismatch only when the frame carries rules_hash8', () => {
    expect(rulesEchoMismatch(undefined, 'none')).toBe(false);
    expect(rulesEchoMismatch({ rules_hash8: 'none' }, 'none')).toBe(false);
    expect(rulesEchoMismatch({ rules_hash8: 'ab12cd34' }, 'ab12cd34')).toBe(false);
    expect(rulesEchoMismatch({ rules_hash8: 'ab12cd34' }, 'none')).toBe(true);
    expect(rulesEchoMismatch({ rules_hash8: 'ab12cd34' }, null)).toBe(false);
  });
});

describe('rules hash guard (review fix F7)', () => {
  it('downgrades when the expected hash is missing for a writable firm session', () => {
    expect(rulesHashMissing(null, false, 'partners-group')).toBe(true);
    expect(rulesHashMissing('ab12cd34', false, 'partners-group')).toBe(false);
    expect(rulesHashMissing(null, true, 'partners-group')).toBe(false); // read-only: no rules
    expect(rulesHashMissing(null, false, null)).toBe(false); // no firm: no rules
    expect(rulesHashMissing(null, false, '')).toBe(false);
  });
});
