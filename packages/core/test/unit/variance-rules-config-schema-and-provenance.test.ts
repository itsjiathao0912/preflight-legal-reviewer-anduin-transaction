import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  loadVarianceRules,
  rulesHash8,
  runVariance,
  RULE_IDS,
  VarianceConfigError,
} from '../../src/variance/index';
import { seededPair } from '../helpers/variance';

/**
 * AC-V19: the variance rules config is versioned and schema-validated; an invalid config fails
 * fast with the failing path (no partial rules, so no finding can be produced); the canonical
 * hash is stable under key reorder and recorded in every finding's provenance.
 */
const RAW = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../src/variance/variance-rules.json', import.meta.url)),
    'utf8',
  ),
) as Record<string, unknown>;
const clone = () => JSON.parse(JSON.stringify(RAW)) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function reorder(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(reorder);
  if (v && typeof v === 'object')
    return Object.fromEntries(
      Object.keys(v as object)
        .reverse()
        .map((k) => [k, reorder((v as Record<string, unknown>)[k])]),
    );
  return v;
}

function failsAt(raw: unknown, path: string) {
  try {
    loadVarianceRules(raw);
  } catch (e) {
    expect(e).toBeInstanceOf(VarianceConfigError);
    expect((e as VarianceConfigError).path).toBe(path);
    return;
  }
  throw new Error(`expected VarianceConfigError at ${path}`);
}

describe('variance-rules-config-schema-and-provenance', () => {
  it('should validate the versioned rules config, fail fast on invalid config and record the hash in provenance', () => {
    const r = loadVarianceRules();
    expect(r.version).toBe('2026.10.2');
    expect(r.hash8).toMatch(/^[0-9a-f]{8}$/);
    expect(r.config.rules.map((x) => x.id).sort()).toEqual([...RULE_IDS].sort());
    expect(Object.isFrozen(r)).toBe(true);
  });

  it('fails fast with the failing path for each class of invalid config', () => {
    const noVersion = clone();
    delete noVersion.version;
    failsAt(noVersion, 'version');
    failsAt({ ...clone(), extra_key: 1 }, '');
    const dup = clone();
    dup.rules.push({ ...dup.rules[0] });
    failsAt(dup, 'rules.20');
    const missing = clone();
    missing.rules = missing.rules.filter((x: { id: string }) => x.id !== 'VAR-COS-FORMAT');
    failsAt(missing, 'rules');
    const upper = clone();
    upper.guards.modals.push('SHALL');
    failsAt(upper, `guards.modals.${upper.guards.modals.length - 1}`);
    const frac = clone();
    frac.new_min_words = 12.5;
    failsAt(frac, 'new_min_words');
    const badRe = clone();
    badRe.routing[0].match.title = '(unclosed';
    failsAt(badRe, 'routing.0.match.title');
    const nested = clone();
    nested.restriction_phrases = ['(a+)+b'];
    failsAt(nested, 'restriction_phrases.0');
    const long = clone();
    long.restriction_phrases = ['x'.repeat(201)];
    failsAt(long, 'restriction_phrases.0');
    const owner = clone();
    owner.routing[0].owners = ['partner'];
    failsAt(owner, 'routing.0.owners.0');
    failsAt('not an object', '');
  });

  it('produces no findings from an invalid config (the load throws before any run)', () => {
    const bad = clone();
    bad.version = 'v1';
    expect(() =>
      runVariance({ ...seededPair('item-amount'), rules: loadVarianceRules(bad) }),
    ).toThrow(VarianceConfigError);
  });

  it('keeps the hash stable under key reorder and changes it when a value changes', () => {
    const base = loadVarianceRules().hash8;
    expect(loadVarianceRules(reorder(RAW)).hash8).toBe(base);
    expect(rulesHash8(reorder(RAW))).toBe(rulesHash8(RAW));
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 0 }] })).toBe('{"a":[2,{"c":0,"d":1}],"b":1}');
    const changed = clone();
    changed.new_min_words = 13;
    expect(loadVarianceRules(changed).hash8).not.toBe(base);
  });

  it('records the rules version and hash in every finding (provenance)', () => {
    const rules = loadVarianceRules();
    const r = runVariance({ ...seededPair('item-audience'), rules });
    expect(r.findings.length).toBeGreaterThan(0);
    for (const f of r.findings) {
      expect(f.detail.facts.variance_rules_hash8).toBe(rules.hash8);
      expect(f.detail.facts.variance_rules_version).toBe(rules.version);
      expect(r.meta[f.id]!.variance_rules_hash8).toBe(rules.hash8);
    }
    const changed = clone();
    changed.new_min_words = 13;
    const r2 = runVariance({ ...seededPair('item-audience'), rules: loadVarianceRules(changed) });
    expect(r2.findings[0]!.detail.facts.variance_rules_hash8).not.toBe(rules.hash8);
  });
});
