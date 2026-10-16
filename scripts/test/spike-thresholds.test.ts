import { describe, expect, it } from 'vitest';
import { judgeS6Size, MiB } from '../src/spikes/s06-local/thresholds';
import { judgeS7 } from '../src/spikes/s07-browser-timing/thresholds';

describe('spike:s06-local size verdict', () => {
  it('PASS below 1 MiB, PASS-WITH-RISK 1-2.5 MiB', () => {
    expect(judgeS6Size(123 * 1024)).toBe('PASS');
    expect(judgeS6Size(1.5 * MiB)).toBe('PASS-WITH-RISK');
  });
  it('fails (kill) when gz size exceeds 2.5 MiB', () => {
    expect(judgeS6Size(2.5 * MiB + 1)).toBe('FAIL');
  });
});

describe('spike:s07 timing verdict', () => {
  it('PASS within pass thresholds', () => {
    expect(judgeS7({ parseMergeMs: 10, pageRenderMs: [40, 356] }).verdict).toBe('PASS');
  });
  it('grey zone is PASS-WITH-RISK', () => {
    expect(judgeS7({ parseMergeMs: 2000, pageRenderMs: [100] }).verdict).toBe('PASS-WITH-RISK');
    expect(judgeS7({ parseMergeMs: 10, pageRenderMs: [900] }).verdict).toBe('PASS-WITH-RISK');
  });
  it('fails past kill thresholds', () => {
    expect(judgeS7({ parseMergeMs: 3001, pageRenderMs: [10] }).verdict).toBe('FAIL');
    expect(judgeS7({ parseMergeMs: 10, pageRenderMs: [10, 1501] }).verdict).toBe('FAIL');
  });
});
