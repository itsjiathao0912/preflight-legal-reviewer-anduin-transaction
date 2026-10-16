import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as barrel from '../../src/index';
import { patternKey as viaFinding } from '../../src/findings/make-finding';
import { patternKey, PATTERN_KEY_MAX } from '../../src/memory/patternKey';
import { detectors } from '../../src/detectors/registry';
import { analyzed, htmlSamples } from '../helpers/samples';

const CHARSET = /^[a-z0-9:#>-]{1,80}$/;

describe('pattern-key (locked spec)', () => {
  it('should build pattern keys with digits stripped, 80-char cap and the safe charset', () => {
    expect(patternKey('ref-label-coherence', 'part-B-of-Section 12')).toBe(
      'ref-label-coherence:part-b-of-section-#',
    );
    expect(patternKey('x', 'Fund 2024 / Class "A" | 99%')).toBe('x:fund-#--class-a--#');
    const long = patternKey('flag-placeholder', 'a'.repeat(200));
    expect(long).toHaveLength(PATTERN_KEY_MAX);
    for (const k of [long, patternKey('a', 'b|c'), patternKey('a', 'Ünïcode “quotes” 12')]) {
      expect(k).toMatch(CHARSET);
      expect(k).not.toContain('|');
      expect(k.slice(k.indexOf(':') + 1)).not.toMatch(/\d/);
    }
  });

  it('is stable and byte-identical for the Phase 01 keys', () => {
    expect(patternKey('ref-this-section', 'this-section')).toBe('ref-this-section:this-section');
    expect(patternKey('ref-label-coherence', 'part-B-of-section')).toBe(
      'ref-label-coherence:part-b-of-section',
    );
    expect(patternKey('undefined-term', 'units->shares')).toBe('undefined-term:units->shares');
    expect(patternKey('undefined-term')).toBe('undefined-term');
    expect(patternKey('a', 'b')).toBe(patternKey('a', 'b'));
  });

  it('single implementation: make-finding re-exports it and the barrel exports it once', () => {
    expect(viaFinding).toBe(patternKey);
    expect(barrel.patternKey).toBe(patternKey);
    const memIndex = readFileSync(new URL('../../src/memory/index.ts', import.meta.url), 'utf8');
    expect(memIndex).not.toMatch(/patternKey/);
    const idx = readFileSync(new URL('../../src/index.ts', import.meta.url), 'utf8');
    expect(idx.match(/\bpatternKey\b/g)).toHaveLength(1);
  });

  it('every finding on the 12 samples carries a charset-clean, digit-free key', () => {
    for (const file of htmlSamples())
      for (const f of analyzed(file).findings) {
        expect(f.pattern_key).toMatch(CHARSET);
        expect(f.pattern_key).not.toMatch(/\d/);
      }
  });

  it('every Phase 02 detector explain()/patternKey() is total over sparse facts', () => {
    const phase01 = ['ref-this-section', 'ref-label-coherence', 'undefined-term'];
    for (const d of detectors) {
      expect(d.patternKey({})).toMatch(CHARSET);
      if (phase01.includes(d.id)) continue; // Phase 01 explain() needs its own facts (residual, report)
      expect(d.explain({})).not.toMatch(/undefined/);
      expect(d.explain({ reference: 'x', used_term: 'Units', defined_term: 'Shares' })).not.toMatch(
        /undefined/,
      );
    }
  });
});
