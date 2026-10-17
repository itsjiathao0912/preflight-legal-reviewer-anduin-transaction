import { AiResultSchema } from '../../contracts/ai';
import { COUNSEL_DRAFT_MODEL_SCHEMA } from '../schemas';
import type { LlmTask } from '../task';
import { UNTRUSTED_NOTICE, userMessage, wrapEnvelope } from './shared';

/** Frozen prompt version (cache key `prompt_ver`). Any prompt text change MUST bump it. */
export const COUNSEL_DRAFT_PROMPT_VERSION = 'counsel-draft@1';
export const COUNSEL_DRAFT_SCHEMA_VERSION = 'counsel-draft.s1';

/** Draft item shape, read from the frozen contract (no second definition). */
const DraftItem = AiResultSchema.shape.drafts.unwrap().element;

const SYSTEM = [
  "You help a digitization analyst write questions to the fund's legal counsel.",
  'For each excerpt write one short, neutral question (at most 1500 characters) asking counsel to confirm ' +
    'the intended meaning or fix of the issue in that excerpt (candidate_id = the excerpt id).',
  'Quote the relevant words from the excerpt; do not invent facts, names or section numbers.',
  UNTRUSTED_NOTICE,
  'Answer with JSON only.',
].join('\n');

const counselDraftV1Def: LlmTask = {
  id: 'counsel-draft',
  promptVersion: COUNSEL_DRAFT_PROMPT_VERSION,
  schemaVersion: COUNSEL_DRAFT_SCHEMA_VERSION,
  requestKind: 'ai',
  modelResultSchema: COUNSEL_DRAFT_MODEL_SCHEMA,
  buildMessages: (input, rules) => [{ role: 'system', content: SYSTEM }, userMessage(input, rules)],
  validate: (modelJson, input, usage) => wrapEnvelope(modelJson, input, usage, 'drafts', DraftItem),
};
export const counselDraftV1: LlmTask = Object.freeze(counselDraftV1Def);
