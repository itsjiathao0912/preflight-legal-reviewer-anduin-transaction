import { z } from 'zod';

/** Frozen model shapes v1 (Phase 01). All adapters emit Line/Cue; the structurer consumes only LineStream. */

export const RegionSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});
export type Region = z.infer<typeof RegionSchema>;

export const CueSchema = z.object({
  bold: z.boolean(),
  caps: z.boolean(),
  indent: z.number(),
  position: z.enum(['left', 'center', 'right', 'unknown']),
  page: z.number().int().positive().optional(),
  region: RegionSchema.optional(),
  cue_source: z.enum(['tag', 'inline_css', 'class', 'ocr']).optional(),
});
export type Cue = z.infer<typeof CueSchema>;

export const LineSchema = z.object({
  text: z.string(),
  cue: CueSchema,
  page: z.number().int().positive().optional(),
  region: RegionSchema.optional(),
});
export type Line = z.infer<typeof LineSchema>;

/** Any adapter output. The structurer accepts both forms. */
export type LineStream = AsyncIterable<Line> | Line[];

export const AnchorSchema = z.object({
  docHash: z.string(),
  blockId: z.string(),
  offsetStart: z.number().int().nonnegative(),
  offsetEnd: z.number().int().nonnegative(),
});
export type Anchor = z.infer<typeof AnchorSchema>;

export const BLOCK_KINDS = [
  'heading',
  'paragraph',
  'list_item',
  'table_row',
  'field',
  'option',
] as const;
export const BlockKindSchema = z.enum(BLOCK_KINDS);
export type BlockKind = z.infer<typeof BlockKindSchema>;

export const BlockSchema = z.object({
  id: z.string(),
  kind: BlockKindSchema,
  lines: z.array(LineSchema),
  section_path: z.array(z.string()),
  scopeId: z.string(),
  anchor: AnchorSchema,
});
export type Block = z.infer<typeof BlockSchema>;

export const ReferenceSchema = z.object({
  id: z.string(),
  text: z.string(),
  kind: z.enum(['internal', 'statutory', 'external']),
  target: z
    .object({
      sectionNumber: z.string(),
      part: z.string().optional(),
      scopeId: z.string(),
    })
    .optional(),
  status: z.enum(['resolved', 'unresolved', 'suspicious']),
  expected: z
    .object({
      sectionNumber: z.string(),
      part: z.string().optional(),
      label: z.string(),
    })
    .optional(),
  anchor: AnchorSchema,
});
export type Reference = z.infer<typeof ReferenceSchema>;

export const GRAPH_NODE_TYPES = ['section', 'block', 'option', 'term', 'field', 'part'] as const;
export const GRAPH_EDGE_TYPES = ['ref', 'conditional', 'contains', 'defines', 'uses'] as const;

export const GraphNodeSchema = z.object({
  id: z.string(),
  type: z.enum(GRAPH_NODE_TYPES),
  label: z.string().optional(),
  anchor: AnchorSchema.optional(),
});
export type GraphNode = z.infer<typeof GraphNodeSchema>;

export const GraphEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: z.enum(GRAPH_EDGE_TYPES),
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;

export const LogicGraphSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
});
export type LogicGraph = z.infer<typeof LogicGraphSchema>;

export const DocSchema = z.object({
  id: z.string(),
  source: z.enum(['html', 'pdf', 'docx', 'ocr']),
  blocks: z.array(BlockSchema),
  graph: LogicGraphSchema.optional(),
  stage_failed: z.enum(['adapter', 'structure']).optional(),
  meta: z.object({
    bytes: z.number().int().nonnegative(),
    adapter_ms: z.number().nonnegative().optional(),
  }),
});
export type Doc = z.infer<typeof DocSchema>;
