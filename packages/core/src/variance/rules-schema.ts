import { z } from 'zod';
import { ISSUE_CLASSES } from '../findings/taxonomy';
import { OWNERS, RULE_IDS } from './types';

/**
 * Strict schema of the versioned variance rules config (AC-V19). Every object is `.strict()`;
 * rule ids are unique; word lists are lower-case; numeric pins are integers; regex sources are
 * length-capped here and compiled (and checked for nested quantifiers) by `loadVarianceRules`.
 */

export const REGEX_MAX_CHARS = 200;

const lower = z
  .string()
  .min(1)
  .max(40)
  .refine((s) => s === s.toLowerCase(), { message: 'word list entries must be lower-case' });
const wordList = z.array(lower).max(200);
const regexSource = z.string().min(1).max(REGEX_MAX_CHARS);
const OwnerSchema = z.enum(OWNERS);
const RuleIdSchema = z.enum(RULE_IDS);
const int = (min: number, max: number) => z.number().int().min(min).max(max);

const RuleDefSchema = z
  .object({
    id: RuleIdSchema,
    class: z.enum(['new', 'changed_logic', 'changed_cosmetic', 'regression']),
    label: z.string().min(1).max(120),
  })
  .strict();

const RoutingRuleSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,40}$/),
    match: z
      .object({
        change_type: z.enum(['new', 'changed_logic']).optional(),
        title: regexSource.optional(),
        rule_id: RuleIdSchema.optional(),
        keywords: wordList.optional(),
        audience_restricted: z.boolean().optional(),
      })
      .strict()
      .refine((m) => Object.keys(m).length > 0, { message: 'routing match must not be empty' }),
    owners: z.array(OwnerSchema).min(1).max(2),
    reason: z.string().min(1).max(160),
  })
  .strict();

const AudienceDimensionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,30}$/),
    label: z.string().min(1).max(40),
    patterns: z.array(regexSource).min(1).max(10),
    complement: z
      .string()
      .regex(/^[a-z0-9-]{1,30}$/)
      .optional(),
  })
  .strict();

export const VarianceRulesConfigSchema = z
  .object({
    version: z.string().regex(/^\d{4}\.\d{1,2}\.\d{1,3}$/),
    tokenizer: z.literal('word-punct'),
    hunk: z
      .object({
        merge_gap_tokens: int(0, 8),
        max_edit_length: int(100, 20000),
      })
      .strict(),
    new_min_words: int(1, 200),
    rules: z.array(RuleDefSchema).min(1).max(64),
    guards: z
      .object({
        negation: wordList,
        modals: wordList,
        conditions: wordList,
        jurisdiction: wordList,
        amount_tokens: wordList,
      })
      .strict(),
    cosmetic: z
      .object({
        name_min_occurrences: int(2, 50),
        name_max_words: int(1, 6),
        renumber_context: wordList,
        months: wordList,
      })
      .strict(),
    audience_dimensions: z.array(AudienceDimensionSchema).min(1).max(20),
    restriction_phrases: z.array(regexSource).min(1).max(20),
    routing: z.array(RoutingRuleSchema).max(50),
    default_owner: OwnerSchema,
    default_reason: z.string().min(1).max(160),
    error_owner_by_issue_class: z.partialRecord(z.enum(ISSUE_CLASSES), OwnerSchema),
    gate_policy: z
      .object({
        untriaged_change_blocks: z.boolean(),
        asked_unanswered_blocks: z.boolean(),
        regression_blocks: z.boolean(),
      })
      .strict(),
    regression: z
      .object({
        max_checks_per_firm: int(1, 200),
        label_max_chars: int(1, 80),
      })
      .strict(),
  })
  .strict()
  .superRefine((c, ctx) => {
    const seen = new Set<string>();
    c.rules.forEach((r, i) => {
      if (seen.has(r.id))
        ctx.addIssue({ code: 'custom', message: `duplicate rule id ${r.id}`, path: ['rules', i] });
      seen.add(r.id);
    });
    for (const id of RULE_IDS)
      if (!seen.has(id))
        ctx.addIssue({ code: 'custom', message: `missing rule id ${id}`, path: ['rules'] });
    const routing = new Set<string>();
    c.routing.forEach((r, i) => {
      if (routing.has(r.id))
        ctx.addIssue({
          code: 'custom',
          message: `duplicate routing id ${r.id}`,
          path: ['routing', i],
        });
      routing.add(r.id);
      if (new Set(r.owners).size !== r.owners.length)
        ctx.addIssue({ code: 'custom', message: 'duplicate owner', path: ['routing', i] });
    });
    const dims = new Set(c.audience_dimensions.map((d) => d.id));
    c.audience_dimensions.forEach((d, i) => {
      if (d.complement && !dims.has(d.complement))
        ctx.addIssue({
          code: 'custom',
          message: `unknown complement ${d.complement}`,
          path: ['audience_dimensions', i],
        });
    });
  });

export type VarianceRulesConfig = z.infer<typeof VarianceRulesConfigSchema>;
export type RoutingRule = VarianceRulesConfig['routing'][number];
