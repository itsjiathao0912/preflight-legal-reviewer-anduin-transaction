import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { api } from '../src/engine/engine.worker';

// Intake Phase 2 (Step B4): readPackageDoc and package-aware analyze settings in the engine worker.
const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const hart = (f: string) =>
  new Uint8Array(readFileSync(join(ROOT, 'fixtures', 'package', 'hartwell', f)));
const SUB = 'fund-iii-subscription-agreement.html';
const LPA = 'northgate-lpa-definitions.docx';
const noop = () => undefined;

describe('engine-package-api (intake Phase 2)', () => {
  it('readPackageDoc returns facts with title lines and definitions', async () => {
    const r = await api.readPackageDoc(
      { kind: 'docx', bytes: hart(LPA), name: LPA },
      { name: LPA },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.facts.format).toBe('docx');
    expect(r.facts.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.facts.titleLines.length).toBeGreaterThan(0);
    expect(r.facts.definitions.some((d) => d.term === 'Units')).toBe(true);
    const s = await api.readPackageDoc(
      { kind: 'html', bytes: hart(SUB), name: SUB },
      { name: SUB },
    );
    expect(s.ok && s.facts.titleLines.length > 0).toBe(true);
  });

  it('analyze with the LPA definitions suppresses the offering-noun finding and reports it', async () => {
    const lpa = await api.readPackageDoc(
      { kind: 'docx', bytes: hart(LPA), name: LPA },
      { name: LPA },
    );
    if (!lpa.ok) throw new Error('lpa read failed');
    const plain = await api.analyze({ kind: 'html', bytes: hart(SUB), name: SUB }, {}, noop);
    const used = (r: typeof plain) =>
      r.findings
        .filter((f) => f.detector_id === 'undefined-term')
        .map((f) => f.detail.facts.used_term);
    expect(used(plain)).toContain('Units');
    const pkg = await api.analyze(
      { kind: 'html', bytes: hart(SUB), name: SUB },
      { packageDefs: lpa.facts.definitions, packageFacts: true },
      noop,
    );
    expect(used(pkg)).not.toContain('Units');
    expect(pkg.packageFacts?.docId).toBe(pkg.docHash);
    expect(pkg.packageFacts?.suppressed.map((s) => s.term)).toContain('Units');
  });

  it('analyze without settings returns no packageFacts and identical findings', async () => {
    const a = await api.analyze({ kind: 'html', bytes: hart(SUB), name: SUB }, {}, noop);
    const b = await api.analyze({ kind: 'html', bytes: hart(SUB), name: SUB }, {}, noop);
    expect(a.packageFacts).toBeUndefined();
    expect(JSON.stringify(a.findings)).toBe(JSON.stringify(b.findings));
    const c = await api.analyze(
      { kind: 'html', bytes: hart(SUB), name: SUB },
      { packageFacts: true },
      noop,
    );
    expect(c.packageFacts).toBeDefined();
    expect(JSON.stringify(c.findings)).toBe(JSON.stringify(a.findings));
  });

  it('a corrupt file returns a code-only failure and never throws', async () => {
    const r = await api.readPackageDoc(
      { kind: 'docx', bytes: new Uint8Array([1, 2, 3, 4]), name: 'broken.docx' },
      { name: 'broken.docx' },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r)).toEqual(['ok', 'code']);
    expect(typeof r.code).toBe('string');
  });
});
