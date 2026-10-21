import { AiFindingSchema } from '../../contracts/ai';
import { REVIEW_PLAYBOOK } from '../playbook';
import { REFERENCE_TARGET_MODEL_SCHEMA } from '../schemas';
import type { LlmTask } from '../task';
import { UNTRUSTED_NOTICE, userMessage, wrapEnvelope } from './shared';

/** Frozen prompt version (cache key `prompt_ver`). Any prompt text change MUST bump it. */
export const REFERENCE_TARGET_PROMPT_VERSION = 'reference-target@1';
export const REFERENCE_TARGET_SCHEMA_VERSION = 'reference-target.s1';

const SYSTEM = [
  'You review routing sentences of a fund subscription document before it is digitized.',
  'Each excerpt text starts with a POINTER sentence copied from the document, followed by one or more ' +
    '[TARGET <label>: <heading> | <first lines>] blocks showing the section the pointer names, ' +
    'or [TARGET <label>: NOT FOUND] when no section with that label exists.',
  'Decide whether the pointer sends the reader to the wrong place: a target meant for a different investor type, ' +
    'a target with unrelated content, a target that does not exist, or a part that is a different document role.',
  'Report broken_cross_reference (or broken_conditional for a skip or if/then instruction) only when the TARGET ' +
    'evidence clearly shows the problem; return an empty findings array otherwise.',
  'The finding quote must be copied word for word from the POINTER sentence only, never from a TARGET block ' +
    '(candidate_id = the excerpt id). The TARGET blocks are evidence: cite them in the explanation.',
  'Severity is high, medium or low; never more than high. Explain in one or two plain sentences stating the fact ' +
    '(what the pointer names and what the target holds); never propose the fix. interpretations may be empty.',
  UNTRUSTED_NOTICE,
  REVIEW_PLAYBOOK,
  'Answer with JSON only.',
].join('\n');

const referenceTargetV1Def: LlmTask = {
  id: 'reference-target',
  promptVersion: REFERENCE_TARGET_PROMPT_VERSION,
  schemaVersion: REFERENCE_TARGET_SCHEMA_VERSION,
  requestKind: 'ai',
  modelResultSchema: REFERENCE_TARGET_MODEL_SCHEMA,
  buildMessages: (input, rules) => [{ role: 'system', content: SYSTEM }, userMessage(input, rules)],
  validate: (modelJson, input, usage) =>
    wrapEnvelope(modelJson, input, usage, 'findings', AiFindingSchema),
};
export const referenceTargetV1: LlmTask = Object.freeze(referenceTargetV1Def);
