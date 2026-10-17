import type { Finding } from '../findings/schema';
import type { Structure } from '../structure/types';
import { buildRegressionFinding } from './adapter';
import { displayAssertionLabel, normalizeAssertionLabel } from './label';
import { defaultVarianceRules, type VarianceRules } from './rules';
import type { AssertionCandidate, RegressionCheck } from './types';

/**
 * The one MVP regression kind (R-01, `scope_exists`). `runVariance` never runs checks; callers run
 * them separately with `runRegressionChecks` (V4 wires it through the engine).
 */

/** One-line preview of an assertion: {scope_exists, "appendix c"} -> "Appendix C must exist". */
export function describeAssertion(a: AssertionCandidate): string {
  return `${displayAssertionLabel(normalizeAssertionLabel(a.label))} must exist`;
}

/** Change descriptor accepted by `assertionCandidateOf`. */
export interface AssertionSource {
  status: 'added' | 'removed' | 'changed';
  unitKind: string;
  unitKey: string;
  title: string;
}

/**
 * Candidate only for a wholly removed or added appendix scope unit (R-01: "Appendix C removed").
 * The label goes through `normalizeAssertionLabel`.
 */
export function assertionCandidateOf(c: AssertionSource): AssertionCandidate | undefined {
  if (c.status === 'changed' || c.unitKind !== 'scope' || !c.unitKey.startsWith('appendix:'))
    return undefined;
  const label = normalizeAssertionLabel(c.title);
  if (!/^appendix \S+$/.test(label)) return undefined;
  return { kind: 'scope_exists', label };
}

/** True when the structure has a scope whose normalized label equals the check label. */
export function scopeExists(structure: Structure, label: string): boolean {
  const want = normalizeAssertionLabel(label);
  return structure.scopes.some((s) => normalizeAssertionLabel(s.title) === want);
}

/**
 * Evaluate `scope_exists` checks against `Structure.scopes` (scopeLabel normalization). A violated
 * check becomes a critical finding "Regression: confirmed in <fund>" with the check statement as
 * the quote; a held check gives nothing. Checks beyond the per-firm cap are ignored.
 */
export function runRegressionChecks(
  structure: Structure,
  checks: readonly RegressionCheck[],
  rules: VarianceRules = defaultVarianceRules(),
): Finding[] {
  const out: Finding[] = [];
  const seen = new Set<string>();
  for (const c of checks.slice(0, rules.config.regression.max_checks_per_firm)) {
    if (c.kind !== 'scope_exists') continue;
    const label = normalizeAssertionLabel(c.label).slice(
      0,
      rules.config.regression.label_max_chars,
    );
    if (!label || seen.has(label)) continue;
    seen.add(label);
    if (scopeExists(structure, label)) continue;
    out.push(
      buildRegressionFinding(
        {
          structure,
          statement: c.statement || describeAssertion({ kind: 'scope_exists', label }),
          label,
          sourceFundName: c.sourceFundName,
        },
        rules,
      ),
    );
  }
  return out;
}
