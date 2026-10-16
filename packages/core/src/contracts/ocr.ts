import { z } from 'zod';
import { limits } from '../config/limits';
import { RegionSchema } from '../model/types';

/** OCR envelope v1. Additive-only. */
const Ext = z.record(z.string(), z.unknown()).optional();

export const OcrRequestSchema = z.object({
  v: z.literal(1),
  mime: z.enum(['image/png', 'image/jpeg', 'application/pdf']),
  pages: z
    .array(z.object({ index: z.number().int().nonnegative(), data_b64: z.string().min(1) }))
    .min(1)
    .max(limits.ocrPagesPerRequest),
  ext: Ext,
});
export type OcrRequest = z.infer<typeof OcrRequestSchema>;

export const OcrResultSchema = z.object({
  v: z.literal(1),
  pages: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      lines: z.array(
        z.object({
          text: z.string().max(4000),
          bbox: RegionSchema.optional(),
          conf: z.number().min(0).max(1).optional(),
        }),
      ),
    }),
  ),
  ext: Ext,
});
export type OcrResult = z.infer<typeof OcrResultSchema>;
