import { z } from 'zod';
import { sha256Hex } from '../model/hash';

export const CacheKeyInputSchema = z.object({
  kind: z.enum(['ai', 'ocr']),
  input_hash: z.string().min(1).max(128),
  model: z.string().min(1).max(120),
  prompt_ver: z.string().min(1).max(40),
  schema_ver: z.string().min(1).max(40),
  /** 'none' when there are no active firm rules. */
  rules_hash: z.string().min(1).max(64),
});
export type CacheKeyInput = z.infer<typeof CacheKeyInputSchema>;

/** cacheKey = hex(sha256([kind,input_hash,model,prompt_ver,schema_ver,rules_hash].join('|'))). Components must not contain '|'. */
export function cacheKey(input: CacheKeyInput): string {
  const c = CacheKeyInputSchema.parse(input);
  const parts = [c.kind, c.input_hash, c.model, c.prompt_ver, c.schema_ver, c.rules_hash];
  for (const p of parts)
    if (p.includes('|')) throw new Error('cache key component must not contain "|"');
  return sha256Hex(parts.join('|'));
}
