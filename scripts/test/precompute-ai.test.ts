import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AiResultSchema, analyzeHtml, verifyAiResult } from '@aduin/core';
import { PRECOMPUTED_DIR, sampleFile } from '../src/record/ai-request';
import {
  PRECOMPUTED_KIND,
  precomputeCases,
  precomputeFromRecordings,
  precomputedName,
  type PrecomputedAi,
} from '../src/precompute/precompute-ai';

let tmp: string | undefined;
afterEach(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  tmp = undefined;
});

describe('precompute-ai (AC34)', () => {
  it('covers exactly samples #1 and #3', () => {
    expect(precomputeCases().map((c) => c.sample)).toEqual(['01', '03']);
  });

  it('--dry-run writes nothing', () => {
    tmp = mkdtempSync(join(tmpdir(), 'precompute-'));
    const out = join(tmp, 'precomputed');
    const rep = precomputeFromRecordings({ outDir: out, write: false });
    expect(rep.files).toHaveLength(2);
    expect(existsSync(out)).toBe(false);
  });

  it('is offline and deterministic: two runs give identical bytes', () => {
    tmp = mkdtempSync(join(tmpdir(), 'precompute-'));
    const a = precomputeFromRecordings({ outDir: join(tmp, 'a'), write: true });
    const b = precomputeFromRecordings({ outDir: join(tmp, 'b'), write: true });
    expect(a.files.map((f) => f.bytes)).toEqual(b.files.map((f) => f.bytes));
    expect(readdirSync(join(tmp, 'a')).sort()).toEqual(readdirSync(join(tmp, 'b')).sort());
  });

  it('the committed files equal a fresh offline build (no stale precomputed output)', () => {
    const rep = precomputeFromRecordings({ write: false });
    for (const f of rep.files) {
      expect(f.path.startsWith(PRECOMPUTED_DIR)).toBe(true);
      expect(f.changed, `${f.path} is stale: run precompute:ai --from-recordings`).toBe(false);
    }
  });

  it('each file is named {docHash}.{rulesHash8}.json and re-verifies against its sample', () => {
    for (const f of precomputeFromRecordings({ write: false }).files) {
      const p = JSON.parse(f.bytes) as PrecomputedAi;
      expect(p.kind).toBe(PRECOMPUTED_KIND);
      expect(p.rulesHash8).toBe('none');
      expect(f.path.endsWith(precomputedName(p.docHash, p.rulesHash8))).toBe(true);
      expect(AiResultSchema.safeParse(p.result).success).toBe(true);
      const g = analyzeHtml(new Uint8Array(readFileSync(sampleFile(p.sample))));
      expect(g.doc.id).toBe(p.docHash);
      const v = verifyAiResult(g, p.result, { model: p.model, provenance: 'cache' });
      if (!v.ok) throw new Error('schema');
      for (const r of v.rejected) expect(r.reason).toBe('quote_not_found');
      expect(v.ok && v.findings.length).toBeGreaterThan(0);
    }
  });
});
