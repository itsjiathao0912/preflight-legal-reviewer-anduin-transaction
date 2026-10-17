// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { intentError, INTENT_REQUIRED_TEXT } from '../src/features/counsel/AnswerForm';

// Variance Phase 04 (D2, AC-V15): intent is human text only. No module assigns the intent field from
// anything but the analyst's own typing: no default value, no auto-fill, no AI draft path.
const COUNSEL = resolve(import.meta.dirname, '..', 'src', 'features', 'counsel');
const read = (n: string) => readFileSync(join(COUNSEL, n), 'utf8');

describe('variance-intent-human-only-static', () => {
  it('only user input sets the intent field', () => {
    const src = read('AnswerForm.tsx');
    const sets = [...src.matchAll(/setIntent\(([^)]*)\)/g)].map((m) => m[1]);
    expect(sets).toEqual(['e.target.value']);
    // initial value is the analyst's earlier recorded intent or empty, never a draft
    expect(src).toMatch(/useState\(initial\?\.intent \?\? ''\)/);
    expect(src).not.toMatch(/defaultValue=\{[^}]*intent/i);
  });

  it('the AI draft path never touches intent', () => {
    for (const f of readdirSync(COUNSEL).filter((n) => /ai-draft|counsel-store/.test(n))) {
      expect(read(f), f).not.toMatch(/intent/i);
    }
    for (const f of readdirSync(COUNSEL).filter((n) => /\.(ts|tsx)$/.test(n))) {
      const src = read(f);
      // no "intent:" assignment fed from an AI or draft value anywhere in the counsel feature
      expect(src, f).not.toMatch(/intent\s*:\s*[^,}\n]*(ai|draft)/i);
    }
  });

  it('whitespace-only intent is refused for firm template; This fund only needs none', () => {
    expect(intentError('   \n ', 'firm_template')).toBe(INTENT_REQUIRED_TEXT);
    expect(intentError('', 'firm_template')).toBe(INTENT_REQUIRED_TEXT);
    expect(intentError('', 'fund')).toBeNull();
    expect(intentError('Appendix C is a firm standard.', 'firm_template')).toBeNull();
  });
});
