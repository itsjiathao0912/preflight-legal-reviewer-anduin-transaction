import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeHtml, fingerprintFor, runDeterministic } from '@aduin/core';
import { DEMO_SQL_PATH, PHASE02_SPEC, ROOT } from '../src/seed/gen-demo-seed';
import { recordedSpecPath } from '../src/seed/check-seed';

// demo-readiness 17-10-26 guard: the deployed demo seed (apps/worker/seed/demo.sql) must only hold
// decisions that a bundled sample actually produces, so the live memory labels show up in the demo.
// The (law firm, fingerprint) pairs are read from the generated SQL itself, not from the spec.
const SAMPLES = resolve(ROOT, 'samples/sub-docs/raw');
const DECISION =
  /^INSERT INTO decision \(workspace_id, id, law_firm_id, fingerprint, [^)]*\) VALUES \('ws_demo', '([^']+)', '([^']+)', '([0-9a-f]{64})'/;

const sql = readFileSync(resolve(ROOT, DEMO_SQL_PATH), 'utf8');
const seeded = sql
  .split('\n')
  .map((l) => DECISION.exec(l))
  .filter((m): m is RegExpExecArray => m !== null)
  .map((m) => ({ id: m[1]!, firm: m[2]!, fp: m[3]! }));

describe('demo seed fingerprints (deployed seed matches bundled samples)', () => {
  it('demo.sql is built from the Partners Group demo spec', () => {
    expect(recordedSpecPath(sql)).toBe(PHASE02_SPEC);
    expect(seeded.length).toBeGreaterThan(0);
    expect(sql.split('\n').filter((l) => l.startsWith('INSERT INTO decision ')).length).toBe(
      seeded.length,
    );
  });

  it('every seeded decision fingerprint equals a finding fingerprint in a bundled HTML sample', () => {
    const firms = [...new Set(seeded.map((s) => s.firm))];
    const fps = new Set<string>();
    for (const f of readdirSync(SAMPLES).filter((x) => x.endsWith('.htm'))) {
      const findings = runDeterministic(
        analyzeHtml(new Uint8Array(readFileSync(resolve(SAMPLES, f)))),
      );
      for (const firm of firms)
        for (const x of findings) {
          const fp = fingerprintFor(x, firm);
          if (fp) fps.add(`${firm}|${fp}`);
        }
    }
    const missing = seeded.filter((s) => !fps.has(`${s.firm}|${s.fp}`)).map((s) => s.id);
    expect(missing).toEqual([]);
  });
});
