// Server-side model selection. The client never chooses a model: `settings.model_tier` maps to a
// server tier (unknown -> default) and the tier maps to the env-configured free lists.
import { assertFreeOnly, type ProxyConfig } from '../config';

export type ProxyKind = 'ai' | 'ocr';

export function freeModelsFor(kind: ProxyKind, cfg: ProxyConfig): readonly string[] {
  const ids = kind === 'ai' ? cfg.textModels : cfg.visionModels;
  // Defense in depth: re-assert on every use (config already validated at load).
  assertFreeOnly(kind === 'ai' ? 'AI_TEXT_MODELS' : 'AI_VISION_MODELS', ids);
  return ids;
}

/** Paid fallback list; empty unless PAID_FALLBACK_ENABLED is exactly "true" and a list is set. */
export function paidModelsFor(cfg: ProxyConfig): readonly string[] {
  return cfg.paidEnabled ? cfg.paidModels : [];
}

/**
 * OCR prompt/schema versions (cache key). AI uses the task registry instead (Phase 05):
 * `prompt_ver` = `TASKS[task].promptVersion`, `schema_ver` = `TASKS[task].schemaVersion`.
 */
export const PROMPT_VER = { ocr: 'ocr1' } as const;
export const SCHEMA_VER = 's1';
/**
 * Output token caps. AI raised 6000 -> 10000 in Phase 05: live sample #3 used 5783 output
 * tokens; a truncated reply (finish_reason "length") is classified malformed.
 */
export const MAX_TOKENS = { ai: 10_000, ocr: 8000 } as const;

const FREE_SUFFIX = ':free';
const baseId = (id: string): string =>
  id.endsWith(FREE_SUFFIX) ? id.slice(0, -FREE_SUFFIX.length) : id;

/**
 * Circuit-breaker judgement for a successful response while paid is disabled.
 * - `paid`: usage.cost > 0, or a parseable served id that is neither a `:free` variant nor
 *   (suffix-normalised) a member of the configured free lists.
 * - `unknown`: served id missing/unparseable and cost 0 -> do NOT trip (caller logs a warning).
 * - `free`: otherwise (incl. a suffix-less served id whose base matches a configured free model).
 */
export function servedTier(
  model: string,
  costUsd: number,
  cfg: ProxyConfig,
): 'free' | 'paid' | 'unknown' {
  if (costUsd > 0) return 'paid';
  if (model === 'unknown') return 'unknown';
  if (model.endsWith(FREE_SUFFIX)) return 'free';
  const free = new Set([...cfg.textModels, ...cfg.visionModels].map(baseId));
  return free.has(baseId(model)) ? 'free' : 'paid';
}
