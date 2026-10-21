import { AiFindingSchema } from '../../contracts/ai';
import { REVIEW_PLAYBOOK } from '../playbook';
import { REFERENCE_TARGET_MODEL_SCHEMA } from '../schemas';
import type { LlmTask } from '../task';
import { UNTRUSTED_NOTICE, userMessage, wrapEnvelope } from './shared';

/** Frozen prompt version (cache key `prompt_ver`). Any prompt text change MUST bump it. */
export const REFERENCE_TARGET_PROMPT_VERSION = 'reference-target@2';
export const REFERENCE_TARGET_SCHEMA_VERSION = 'reference-target.s2';

/** Model items below this confidence are not reported even when the verdict is mismatch. */
export const REFERENCE_TARGET_MIN_CONFIDENCE = 0.5;

const SYSTEM = [
  'You review routing sentences of a fund subscription document before it is digitized.',
  'Each excerpt text starts with a POINTER sentence copied from the document, followed by exactly one ' +
    '[TARGET <label>: <heading> | <first lines>] block showing the section that ONE label of the pointer names, ' +
    'or [TARGET <label>: NOT FOUND] when no section with that label exists, and sometimes a [NOTE: ...] line ' +
    'with facts from the document (other labels the same pointer names, which of several same-label headings ' +
    'is shown, whether the pointer sits inside that section).',
  'Judge only the label in the TARGET block. If the pointer names several labels, each label comes in its own ' +
    'excerpt; judge each one against its own target and do not mix them up.',
  'For EVERY excerpt return exactly one item: candidate_id = the excerpt id, label = the label you judged ' +
    '(for example "Section D"), pointer_addresses = who or what the pointer sends there (investor type or ' +
    'group, document or part it names, including any group it excludes), target_is_for = who or what the target ' +
    'section is for according to its heading and first lines, then verdict, decided by comparing those two:',
  '- match: the target fits the pointer (same investor type, same purpose, the document or part the pointer names);',
  '- mismatch: the target evidence clearly shows the pointer sends that reader to the wrong place: a target meant ' +
    'for a different investor type, a target with unrelated content, a target that does not exist, or a part that ' +
    'is a different document role than the one the pointer names;',
  '- unclear: the evidence is not enough to decide.',
  'Read exclusions carefully: a pointer for readers who are NOT in a group (or for everyone except a group) is a ' +
    'mismatch when its target is only for that group. A target meant for every investor fits any group.',
  'The TARGET shows only the heading and first lines. A pointer to a provision deeper inside the target (a numbered ' +
    'paragraph, clause or sub-item, or a topic covered later in it) is not a mismatch just because the first lines ' +
    'are about something else; judge the heading and audience.',
  'NOT FOUND means the tool detected no heading with that label; the heading may still exist in a layout the tool ' +
    'missed. For NOT FOUND, answer unclear unless the labels the NOTE lists as found clearly show the label is missing ' +
    '(for example the pointer names a later letter than any found).',
  'When the NOTE says the label appears several times, the pointer may mean any of those sections: the verdict is ' +
    'mismatch only when none of the listed headings can fit the pointer.',
  'When in doubt, the verdict is match or unclear, never mismatch. A match or unclear item is not a finding; ' +
    'never write "no issue" or "correct" text in a mismatch item.',
  'For a mismatch: issue_class is broken_cross_reference (or broken_conditional for a skip or if/then ' +
    'instruction), severity is high, medium or low (never more than high). The explanation, in one or two plain ' +
    'sentences, must name who or what the pointer addresses (which investor type, or which document or part) ' +
    'and who or what the target section is for; state the fact, never propose the fix.',
  'The quote must be copied word for word from the POINTER sentence only, never from a TARGET or NOTE line. ' +
    'The TARGET and NOTE lines are evidence: cite them in the explanation. interpretations may be empty.',
  UNTRUSTED_NOTICE,
  REVIEW_PLAYBOOK,
  'Answer with JSON only.',
].join('\n');

/**
 * Model-side verdicts to findings: keep items whose verdict is 'mismatch' (confidence at least
 * REFERENCE_TARGET_MIN_CONFIDENCE) and strip the model-only `label`, `pointer_addresses`, `target_is_for` and `verdict` fields, so the
 * result has the unchanged AiFinding shape. Match / unclear items are answers, not findings, and
 * are not counted as dropped. Items without a verdict are invalid and counted as dropped.
 */
export function keepMismatches(modelJson: unknown): unknown {
  if (typeof modelJson !== 'object' || modelJson === null || Array.isArray(modelJson))
    return modelJson;
  const findings = (modelJson as Record<string, unknown>)['findings'];
  if (!Array.isArray(findings)) return modelJson;
  const kept: unknown[] = [];
  for (const raw of findings) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      kept.push(raw);
      continue;
    }
    const {
      verdict,
      label: _label,
      pointer_addresses: _pa,
      target_is_for: _tf,
      ...rest
    } = raw as Record<string, unknown>;
    if (verdict === undefined) {
      kept.push(null); // no verdict: invalid item, counted as dropped by wrapEnvelope
      continue;
    }
    const conf = rest['confidence'];
    if (verdict !== 'mismatch') continue;
    if (typeof conf === 'number' && conf < REFERENCE_TARGET_MIN_CONFIDENCE) continue;
    kept.push(rest);
  }
  return { ...(modelJson as Record<string, unknown>), findings: kept };
}

const referenceTargetV1Def: LlmTask = {
  id: 'reference-target',
  promptVersion: REFERENCE_TARGET_PROMPT_VERSION,
  schemaVersion: REFERENCE_TARGET_SCHEMA_VERSION,
  requestKind: 'ai',
  modelResultSchema: REFERENCE_TARGET_MODEL_SCHEMA,
  buildMessages: (input, rules) => [{ role: 'system', content: SYSTEM }, userMessage(input, rules)],
  validate: (modelJson, input, usage) =>
    wrapEnvelope(keepMismatches(modelJson), input, usage, 'findings', AiFindingSchema),
};
export const referenceTargetV1: LlmTask = Object.freeze(referenceTargetV1Def);
