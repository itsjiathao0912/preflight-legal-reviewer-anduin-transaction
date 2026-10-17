import { describe, expect, it } from 'vitest';
import {
  FPW_KEY,
  FPW_STEP,
  FPW_STEP_BIG,
  clampPct,
  defaultPct,
  pctFromKey,
  pctFromPointer,
  readPct,
} from './width-math';

// AC-5: panel width math.
describe('findings-v2-width-math', () => {
  it('constants', () => {
    expect(FPW_KEY).toBe('ui:v1:fpw');
    expect([FPW_STEP, FPW_STEP_BIG]).toEqual([2, 10]);
  });
  it('clamps and rounds', () => {
    expect(clampPct(10)).toBe(40);
    expect(clampPct(99)).toBe(65);
    expect(clampPct(52.6)).toBe(53);
    expect(clampPct(Number.NaN)).toBe(40);
  });
  it('defaults to 50 at 1280 and wider, 55 below', () => {
    expect(defaultPct(1280)).toBe(50);
    expect(defaultPct(1440)).toBe(50);
    expect(defaultPct(1279)).toBe(55);
  });
  it('readPct accepts only integers 40..65', () => {
    expect(readPct('60', 1440)).toBe(60);
    expect(readPct(null, 1440)).toBe(50);
    expect(readPct('abc', 1000)).toBe(55);
    expect(readPct('39', 1440)).toBe(50);
    expect(readPct('66', 1440)).toBe(50);
    expect(readPct('50.5', 1440)).toBe(50);
    expect(readPct('', 1000)).toBe(55);
  });
  it('pointer math treats the panel as the right column', () => {
    expect(pctFromPointer(500, { left: 0, width: 1000 })).toBe(50);
    expect(pctFromPointer(600, { left: 100, width: 1000 })).toBe(50);
    expect(pctFromPointer(0, { left: 0, width: 1000 })).toBe(65);
    expect(pctFromPointer(1000, { left: 0, width: 1000 })).toBe(40);
    expect(pctFromPointer(10, { left: 0, width: 0 })).toBe(40);
  });
  it('key math: ArrowLeft widens, ArrowRight narrows, Home and End', () => {
    expect(pctFromKey(50, 'ArrowLeft')).toBe(52);
    expect(pctFromKey(50, 'ArrowLeft', true)).toBe(60);
    expect(pctFromKey(50, 'ArrowRight')).toBe(48);
    expect(pctFromKey(50, 'ArrowRight', true)).toBe(40);
    expect(pctFromKey(64, 'ArrowLeft', true)).toBe(65);
    expect(pctFromKey(50, 'Home')).toBe(40);
    expect(pctFromKey(50, 'End')).toBe(65);
    expect(pctFromKey(50, 'a')).toBeNull();
  });
});
