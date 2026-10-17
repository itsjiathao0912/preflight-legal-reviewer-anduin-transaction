/**
 * record-ocr: thin wrapper (Phase 06f, D5) - NO separate spend. Copies the precomputed live OCR
 * results of chosen scan-set pages into fixtures/llm-recordings/ocr/{raw}.ocr2.precomputed.json as
 * recorded CI fixtures (response content only: no headers, no key). Live requests happen only in
 * precompute-ocr (same guards); this script is offline.
 *
 *   pnpm --filter @aduin/scripts record:ocr                 # default pages 1,2,6,8,19
 *   OCR_PAGES=1,2 pnpm --filter @aduin/scripts record:ocr
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OCR_PRECOMPUTED_DIR, ocrPageKey, readPrecomputed } from '../precompute/precompute-ocr';
import { ROOT, scanPages } from '../samples/scan-set';

export const OCR_RECORDINGS_DIR = join(ROOT, 'fixtures', 'llm-recordings', 'ocr');
export const DEFAULT_RECORD_PAGES = [1, 2, 6, 8, 19];

export function recordFromPrecomputed(pages: readonly number[] = DEFAULT_RECORD_PAGES): {
  wrote: string[];
  missing: number[];
} {
  mkdirSync(OCR_RECORDINGS_DIR, { recursive: true });
  const wrote: string[] = [];
  const missing: number[] = [];
  for (const p of scanPages()) {
    if (!pages.includes(p.n)) continue;
    const pre = readPrecomputed(OCR_PRECOMPUTED_DIR, ocrPageKey(p.sourceHash, p.n - 1));
    if (!pre) {
      missing.push(p.n);
      continue;
    }
    const raw = p.raw.replace(/\.jpg$/, '');
    const file = join(OCR_RECORDINGS_DIR, `${raw}.ocr2.precomputed.json`);
    const out = {
      _meta: {
        source: `samples/sub-docs/raw/09-rw-holdings-scans/${p.raw}`,
        page: p.n,
        downscale: '1600px long edge, JPEG q80 (jpeg-js)',
        model: pre.model,
        served_model: pre.served_model,
        prompt_ver: pre.promptVer,
        schema_ver: pre.schemaVer,
        recorded: pre.recorded,
        usage_cost: 0,
        note: 'Live free-model response content only (no headers, no key). Phase 06f precompute.',
      },
      result: pre.result,
    };
    writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
    wrote.push(file);
  }
  return { wrote, missing };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const env = process.env['OCR_PAGES'];
  const pages = env ? env.split(',').map((s) => Number(s.trim())) : DEFAULT_RECORD_PAGES;
  const r = recordFromPrecomputed(pages);
  console.log(
    `record:ocr wrote ${r.wrote.length}; missing precomputed: ${r.missing.join(', ') || 'none'}`,
  );
}
