import { z } from 'zod';
import { maskText } from '../detectors/util';
import {
  OUTLINE_DISCLAIMER,
  OUTLINE_NAME_MAX,
  OUTLINE_SCHEMA_ID,
  OUTLINE_TEXT_MAX,
} from './version';

/**
 * Form logic outline v1 (AC63): a reference-only JSON projection of the masked StructureView.
 * Fixed key order, document order, no records, no timestamps, no full document text.
 */
const text = z.string().max(OUTLINE_TEXT_MAX);
const id = z.string().min(1).max(OUTLINE_TEXT_MAX);

const SectionSchema = z.strictObject({
  id,
  number: text,
  title: text,
  depth: z.union([z.literal(0), z.literal(1)]),
  restart: z.boolean(),
  refsIn: z.number().int().nonnegative(),
  refsOut: z.number().int().nonnegative(),
});

const InternalRefSchema = z.strictObject({
  id,
  text,
  where: text,
  status: z.enum(['resolved', 'suspicious', 'unresolved']),
  target: text.optional(),
  expected: text.nullable().optional(),
  external: z.literal(false).optional(),
});

const ExternalRefSchema = z.strictObject({
  id,
  text,
  where: text,
  source: text,
  external: z.literal(true),
});

const BranchSchema = z.strictObject({
  id,
  kind: z.enum(['whitelist', 'role', 'skip', 'negative', 'jump']),
  where: text,
  condition: text,
  targets: z.array(text),
  targetFound: z.boolean(),
  citation: text,
});

const TermSchema = z.strictObject({
  term: text,
  definedAt: text,
  uses: z.number().int().nonnegative(),
  status: z.enum(['ok', 'early', 'twice', 'none', 'unused', 'case']),
  note: text.optional(),
});

const SectionRefSchema = z.strictObject({ number: text, title: text });

const InvestorPathSchema = z
  .strictObject({
    type: text,
    label: text,
    sections: z.array(SectionRefSchema),
    skipped: z.array(SectionRefSchema),
    questions: z.array(z.strictObject({ section: text, text })),
    reachesCompletion: z.boolean(),
    uncertain: z.boolean(),
    gapCount: z.number().int().nonnegative(),
  })
  .describe(
    'Investor-type path. Heuristic: derived from routing cues in the document, with no ground truth; check it against the form.',
  );

export const OutlineSchema = z
  .strictObject({
    schema: z.literal(OUTLINE_SCHEMA_ID),
    disclaimer: z.literal(OUTLINE_DISCLAIMER),
    document: z.strictObject({
      name: z.string().min(1).max(OUTLINE_NAME_MAX),
      format: z.enum(['html', 'pdf', 'docx', 'ocr']),
      contentHash: z.string().regex(/^[0-9a-f]{64}$/),
      pageCount: z.number().int().nonnegative().optional(),
    }),
    sections: z.array(SectionSchema),
    references: z.array(z.union([InternalRefSchema, ExternalRefSchema])),
    branches: z.array(BranchSchema),
    definedTerms: z.array(TermSchema),
    investorPaths: z
      .array(InvestorPathSchema)
      .describe('Investor-type paths are heuristic (no ground truth); reference only.'),
    confidenceNote: text.optional(),
    counts: z.strictObject({
      sections: z.number().int().nonnegative(),
      references: z.number().int().nonnegative(),
      branches: z.number().int().nonnegative(),
      definedTerms: z.number().int().nonnegative(),
      investorPaths: z.number().int().nonnegative(),
    }),
  })
  .describe(`${OUTLINE_DISCLAIMER} Form logic outline exported from the structure view.`);

export type Outline = z.infer<typeof OutlineSchema>;
/** What the engine worker emits: everything but the document name (added on the main thread). */
export type OutlineDraft = Omit<Outline, 'document'> & {
  document: Omit<Outline['document'], 'name'>;
};

/** Masked, clipped document name for `document.name` (falls back to "document"). */
export function maskOutlineName(name: string): string {
  const m = maskText(String(name ?? ''))
    .trim()
    .slice(0, OUTLINE_NAME_MAX)
    .trim();
  return m || 'document';
}

/** `{base}.logic-outline.json`: masked, extension stripped, safe characters only, capped at 80. */
export function outlineFilename(name: string): string {
  const masked = maskText(String(name ?? ''));
  const noExt = masked.replace(/\.[A-Za-z0-9]{1,8}$/, '');
  const base = noExt
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80)
    .replace(/[-.]+$/g, '');
  return `${base || 'document'}.logic-outline.json`;
}
