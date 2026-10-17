import { ISSUE_CLASSES } from '../findings/taxonomy';

/**
 * Model-facing JSON schemas (hand-written, strict): every key required, no `v`, `usage` or `ext`.
 * The Worker wraps the model JSON into the AiResult envelope (v:1, usage) and validates it once
 * with `AiResultSchema` plus the task validator.
 */
export type JsonSchema = { readonly [k: string]: unknown };

export interface ModelResultSchema {
  /** `response_format.json_schema.name` */
  name: string;
  schema: JsonSchema;
}

const str = (maxLength: number): JsonSchema => ({ type: 'string', minLength: 1, maxLength });

export const CLAUSE_JUDGMENT_MODEL_SCHEMA: ModelResultSchema = Object.freeze({
  name: 'clause_judgment_v1',
  schema: Object.freeze({
    type: 'object',
    additionalProperties: false,
    required: ['findings'],
    properties: {
      findings: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'candidate_id',
            'issue_class',
            'severity',
            'confidence',
            'quote',
            'explanation',
            'interpretations',
          ],
          properties: {
            candidate_id: str(64),
            issue_class: { type: 'string', enum: [...ISSUE_CLASSES] },
            severity: { type: 'string', enum: ['high', 'medium', 'low'] },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            quote: str(1000),
            explanation: str(1000),
            interpretations: { type: 'array', maxItems: 6, items: str(500) },
          },
        },
      },
    },
  }),
});

export const COUNSEL_DRAFT_MODEL_SCHEMA: ModelResultSchema = Object.freeze({
  name: 'counsel_draft_v1',
  schema: Object.freeze({
    type: 'object',
    additionalProperties: false,
    required: ['drafts'],
    properties: {
      drafts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['candidate_id', 'text'],
          properties: { candidate_id: str(64), text: str(1500) },
        },
      },
    },
  }),
});
