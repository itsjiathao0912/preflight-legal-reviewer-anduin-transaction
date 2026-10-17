import { AiFindingSchema } from '../../contracts/ai';
import { CLAUSE_JUDGMENT_MODEL_SCHEMA } from '../schemas';
import type { LlmTask } from '../task';
import { UNTRUSTED_NOTICE, userMessage, wrapEnvelope } from './shared';

/** Frozen prompt version (cache key `prompt_ver`). Any prompt text change MUST bump it. */
export const CLAUSE_JUDGMENT_PROMPT_VERSION = 'clause-judgment@1';
export const CLAUSE_JUDGMENT_SCHEMA_VERSION = 'clause-judgment.s1';

const SYSTEM = [
  'You review excerpts of a fund subscription document before it is digitized.',
  'For each excerpt decide whether it contains a real drafting issue: ambiguity, a logic contradiction, ' +
    'a meaning-changing typo, a broken cross-reference or conditional, an option gap or overlap, or a defined-term issue.',
  'Report only issues you are confident about; return an empty findings array when there are none.',
  'Every finding must quote, word for word, a short passage copied from that excerpt (candidate_id = the excerpt id).',
  'Severity is high, medium or low; never more than high. Explain in one or two plain sentences; ' +
    'interpretations lists the plausible readings (may be empty).',
  UNTRUSTED_NOTICE,
  'Answer with JSON only.',
].join('\n');

const clauseJudgmentV1Def: LlmTask = {
  id: 'clause-judgment',
  promptVersion: CLAUSE_JUDGMENT_PROMPT_VERSION,
  schemaVersion: CLAUSE_JUDGMENT_SCHEMA_VERSION,
  requestKind: 'ai',
  modelResultSchema: CLAUSE_JUDGMENT_MODEL_SCHEMA,
  buildMessages: (input, rules) => [{ role: 'system', content: SYSTEM }, userMessage(input, rules)],
  validate: (modelJson, input, usage) =>
    wrapEnvelope(modelJson, input, usage, 'findings', AiFindingSchema),
};
export const clauseJudgmentV1: LlmTask = Object.freeze(clauseJudgmentV1Def);
