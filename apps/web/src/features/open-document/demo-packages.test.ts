import { describe, expect, it } from 'vitest';
import { visibleDemoPackages, type DemoPackage } from './demo-packages';

const pkg = (id: string, n: number): DemoPackage => ({
  id,
  title: id,
  firmId: null,
  fund: 'F',
  version: 'v1',
  members: Array.from({ length: n }, (_, i) => ({ kind: 'sample' as const, sampleId: `0${i}` })),
});

describe('visibleDemoPackages', () => {
  const list = [pkg('big', 7), pkg('six', 6), pkg('five', 5), pkg('one', 1)];

  it('lists only packages with 6 or more files, in order', () => {
    expect(visibleDemoPackages(list, false).map((p) => p.id)).toEqual(['big', 'six']);
  });

  it('lists every package when showAll is set (e2e build)', () => {
    expect(visibleDemoPackages(list, true).map((p) => p.id)).toEqual(['big', 'six', 'five', 'one']);
  });

  it('returns an empty list for no packages', () => {
    expect(visibleDemoPackages([], false)).toEqual([]);
  });
});
