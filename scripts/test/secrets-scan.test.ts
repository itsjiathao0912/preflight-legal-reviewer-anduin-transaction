import { afterEach, describe, expect, it } from 'vitest';
import { secretsScan } from '../src/guards/secrets-scan';
import { tmpRepo } from './tmp-repo';

// Fake key assembled from parts at runtime; never commit the literal prefix.
const orKey = ['sk', 'or', 'v1', 'a'.repeat(40)].join('-');
const envRead = ['process', 'env', 'OPENROUTER_API_KEY'].join('.');
let cleanup = () => {};
afterEach(() => cleanup());

function run(files: Record<string, string>) {
  const repo = tmpRepo(files);
  cleanup = repo.cleanup;
  return secretsScan(repo.root).map((f) => `${f.file}:${f.rule}`);
}

describe('secrets:scan', () => {
  it('passes code that reads keys from env', () => {
    expect(run({ 'scripts/src/a.ts': `const OPENROUTER_API_KEY = ${envRead};` })).toEqual([]);
  });

  it('fails on an OpenRouter key prefix', () => {
    expect(run({ 'apps/worker/src/a.ts': `const k = "${orKey}";` })).toContain(
      'apps/worker/src/a.ts:openrouter-key-prefix',
    );
  });

  it('fails on a long literal assigned to *_KEY / *_SECRET', () => {
    const hex = 'ab12'.repeat(10);
    expect(
      run({ 'scripts/src/b.ts': `const CF_API_KEY = "${hex}";\nSESSION_SECRET=${hex}` }),
    ).toEqual(['scripts/src/b.ts:literal_key', 'scripts/src/b.ts:literal_secret']);
  });

  it('fails when a secrets file is present and not ignored', () => {
    const dv = ['.dev', 'vars'].join('.');
    const en = ['', 'env'].join('.');
    expect(run({ [`apps/worker/${dv}`]: 'X=1', [en]: 'Y=1', [`${en}.example`]: 'Y=' })).toEqual([
      `${en}:secret-file-tracked`,
      `apps/worker/${dv}:secret-file-tracked`,
    ]);
  });

  it('does not flag a gitignored secrets file', () => {
    const dv = ['.dev', 'vars'].join('.');
    expect(run({ '.gitignore': `${dv}\n`, [`apps/worker/${dv}`]: 'X=1' })).toEqual([]);
  });

  // OpenAI provider plan (4.5, AC17): fixtures built at runtime, never key-shaped literals
  it('flags OpenAI project and legacy keys as rule openai-key', () => {
    const proj = ['sk', 'proj', 'Ab3_'.repeat(8)].join('-');
    const legacy = ['sk', 'Zx9'.repeat(10)].join('-');
    expect(run({ 'apps/worker/src/c.ts': `const a = "${proj}";\nconst b = '${legacy}';` })).toEqual(
      ['apps/worker/src/c.ts:openai-key', 'apps/worker/src/c.ts:openai-key'],
    );
  });

  it('keeps an OpenRouter key on rule openrouter-key-prefix only', () => {
    expect(run({ 'apps/worker/src/d.ts': `const k = "${orKey}";` })).toEqual([
      'apps/worker/src/d.ts:openrouter-key-prefix',
    ]);
  });

  it('does not flag short sk- words or hyphenated identifiers', () => {
    const word = ['risk', 'evidence', 'pack', 'validator', 'with', 'a', 'long', 'tail'].join('-');
    const short = ['sk', 'abc'].join('-');
    const desk = ['desk', 'proj', 'a'.repeat(30)].join('-');
    expect(run({ 'scripts/src/e.ts': `// ${word} ${short} ${desk}\n` })).toEqual([]);
  });
});
