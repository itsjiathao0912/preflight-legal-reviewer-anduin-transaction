import { describe, expect, it } from 'vitest';
import * as core from '../../src/index';

describe('@aduin/core smoke', () => {
  it('loads the barrel', () => {
    expect(core.CORE_PACKAGE).toBe('@aduin/core');
  });

  it('barrel seam exposes only the package marker before Phase 01', () => {
    expect(Object.keys(core)).toEqual(['CORE_PACKAGE']);
  });
});
