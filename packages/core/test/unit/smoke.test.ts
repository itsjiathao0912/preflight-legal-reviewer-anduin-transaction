import { describe, expect, it } from 'vitest';
import * as core from '../../src/index';

describe('@aduin/core smoke', () => {
  it('loads the barrel', () => {
    expect(core.CORE_PACKAGE).toBe('@aduin/core');
  });

  it('barrel exposes the Phase 01 public API (append-only seam)', () => {
    for (const name of [
      'CORE_PACKAGE',
      'analyzeHtml',
      'runDeterministic',
      'detectors',
      'FindingSchema',
      'FindingWireSchema',
      'normalize',
      'quoteHash',
      'fingerprint',
      'fingerprintFor',
      'mask',
      'resolveLabel',
      'rulesHash',
      'snapToSentence',
      'resolveFirm',
      'LAW_FIRMS',
      'signCookie',
      'verifyCookie',
      'resign',
      'SessionClaimsSchema',
      'cacheKey',
      'parseFrameLine',
      'errorStatus',
      'ErrorBodySchema',
      'MEMORY_LABELS',
      'limits',
      'DemoSeedSpecSchema',
    ]) {
      expect(core, name).toHaveProperty(name);
    }
  });
});
