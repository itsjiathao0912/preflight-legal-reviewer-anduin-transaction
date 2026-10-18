import { afterEach, describe, expect, it } from 'vitest';
import { guardCf, scanText } from '../src/guards/guard-cf';
import { tmpRepo } from './tmp-repo';

// Forbidden values are assembled at runtime; never commit them as literals.
const zoneId = '894bc9f9' + '3640fab2' + '60bf1580' + 'b5b48cb7';
const zoneName = 'itsjiathao' + '.' + 'com';
let cleanup = () => {};
afterEach(() => cleanup());

function run(files: Record<string, string>) {
  const repo = tmpRepo(files);
  cleanup = repo.cleanup;
  return guardCf(repo.root).map((f) => `${f.file}:${f.rule}`);
}

const okWrangler =
  '{ "name": "aduin-transaction-web", "d1_databases": [{ "database_name": "aduin-transaction-db" }] }';

describe('guard:cf', () => {
  it('passes a clean prefixed config', () => {
    expect(run({ 'apps/worker/wrangler.jsonc': okWrangler })).toEqual([]);
  });

  it('fails on the zone id in a script', () => {
    expect(run({ 'scripts/src/deploy.ts': `const z = "${zoneId}";` })).toEqual([
      'scripts/src/deploy.ts:zone-id',
    ]);
  });

  it('fails on the zone name in app source', () => {
    expect(run({ 'apps/web/src/x.ts': `fetch("https://api.${zoneName}")` })).toEqual([
      'apps/web/src/x.ts:zone-name',
    ]);
  });

  it('fails on routes and custom_domain keys in a wrangler config', () => {
    const cfg =
      '{ "name": "aduin-transaction-web", "routes": [{ "pattern": "a/*", "custom_domain": true }] }';
    expect(run({ 'apps/worker/wrangler.jsonc': cfg })).toEqual([
      'apps/worker/wrangler.jsonc:wrangler-routes-key',
      'apps/worker/wrangler.jsonc:wrangler-custom_domain-key',
    ]);
  });

  it('fails on an unprefixed Worker or D1 name', () => {
    const cfg = '{ "name": "my-worker", "d1_databases": [{ "database_name": "other-db" }] }';
    expect(run({ 'wrangler.toml': cfg })).toEqual([
      'wrangler.toml:unprefixed-name',
      'wrangler.toml:unprefixed-database_name',
    ]);
  });

  it('ignores excluded and out-of-scope paths', () => {
    expect(
      run({
        'process/notes.md': zoneId,
        'docs/x.md': zoneId,
        'CLAUDE.md': zoneName,
        'scripts/test/fixture.ts': zoneId,
        'samples/a.htm': zoneId,
      }),
    ).toEqual([]);
  });

  describe('README author link allowlist', () => {
    const rules = (file: string, text: string) => scanText(file, text).map((f) => f.rule);
    const link = `https://${zoneName}/`;

    it('allows the exact author link in the root README', () => {
      expect(rules('README.md', `[Website](${link})`)).toEqual([]);
    });

    it('rejects the same link in any other file', () => {
      expect(rules('docs/x.md', `[Website](${link})`)).toEqual(['zone-name']);
    });

    it('rejects the http form in the README', () => {
      expect(rules('README.md', `http://${zoneName}/`)).toEqual(['zone-name']);
    });

    it('rejects a subdomain in the README', () => {
      expect(rules('README.md', `https://www.${zoneName}/`)).toEqual(['zone-name']);
      expect(rules('README.md', `https://api.${zoneName}/`)).toEqual(['zone-name']);
    });

    it('rejects the bare domain and a link without the trailing slash in the README', () => {
      expect(rules('README.md', `see ${zoneName} here`)).toEqual(['zone-name']);
      expect(rules('README.md', `https://${zoneName}`)).toEqual(['zone-name']);
    });

    it('rejects the zone id in the README', () => {
      expect(rules('README.md', `${link} ${zoneId}`)).toEqual(['zone-id']);
    });
  });
});
