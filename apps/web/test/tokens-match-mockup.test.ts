// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { rootVars } from './support/mockupCss';

const TOKENS = resolve(import.meta.dirname, '..', 'src', 'styles', 'tokens.css');

/** CSS value normalization: hex case, whitespace and leading zeros only (Prettier lowercases hex in tokens.css). */
const norm = (v: string | undefined) =>
  v
    ?.replace(/#[0-9a-fA-F]{3,8}\b/g, (h) => h.toLowerCase())
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ',')
    .replace(/(^|[^\d])0\.(\d)/g, '$1.$2')
    .trim();

describe('tokens-match-mockup', () => {
  it('should match every app.html :root custom property in tokens.css', () => {
    const mock = rootVars();
    const ours = rootVars(readFileSync(TOKENS, 'utf8'));
    expect(Object.keys(mock).length).toBeGreaterThanOrEqual(20);
    for (const [k, v] of Object.entries(mock)) expect(norm(ours[k]), k).toBe(norm(v));
    expect(Object.keys(ours).sort()).toEqual(Object.keys(mock).sort());
  });
});
