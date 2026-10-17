import { AI_TASK_IDS, type AiTaskId } from '../contracts/ai';
import type { LlmTask } from './task';
import { clauseJudgmentV1 } from './tasks/clause-judgment.v1';
import { counselDraftV1 } from './tasks/counsel-draft.v1';
import { driftNarrativeV1 } from './tasks/drift-narrative.v1';

/**
 * Shared versioned task registry: the Worker builds messages from it, the client never sends prompts.
 * Append-only: later phases add one entry (e.g. Phase 07 drift-narrative) and its id in
 * `AI_TASK_IDS` (contracts/ai.ts).
 */
export const TASKS: Readonly<Record<AiTaskId, LlmTask>> = Object.freeze({
  'clause-judgment': clauseJudgmentV1,
  'counsel-draft': counselDraftV1,
  'drift-narrative': driftNarrativeV1,
});

export const DEFAULT_TASK_ID: AiTaskId = 'clause-judgment';

/** Task by id; undefined for an unknown id (callers map that to invalid_request). */
export function taskById(id: string): LlmTask | undefined {
  return (AI_TASK_IDS as readonly string[]).includes(id) ? TASKS[id as AiTaskId] : undefined;
}
