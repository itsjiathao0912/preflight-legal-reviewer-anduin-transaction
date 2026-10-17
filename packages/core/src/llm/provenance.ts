import type { Finding } from '../findings/schema';

/** Label shown on every AI finding (AI-only findings never gate unless the analyst promotes them). */
export const AI_SUGGESTION_LABEL = 'AI suggestion';

export type AiSource = 'fresh' | 'cache';

/** Display provenance: rule id for deterministic findings, model + fresh/cache for AI findings. */
export type Provenance =
  | { kind: 'rule'; ruleId: string }
  | { kind: 'ai'; model: string; source: AiSource; label: typeof AI_SUGGESTION_LABEL };

export function provenanceOf(
  f: Pick<Finding, 'detector_kind' | 'detector_id' | 'model' | 'provenance'>,
): Provenance {
  if (f.detector_kind === 'rule') return { kind: 'rule', ruleId: f.detector_id };
  return {
    kind: 'ai',
    model: f.model ?? 'unknown',
    source: f.provenance ?? 'fresh',
    label: AI_SUGGESTION_LABEL,
  };
}

/** Short chip text: "Rule ref-this-section" / "AI suggestion · from cache". */
export function provenanceText(p: Provenance): string {
  if (p.kind === 'rule') return `Rule ${p.ruleId}`;
  return `${p.label} · ${p.source === 'cache' ? 'from cache' : 'fresh'}`;
}
