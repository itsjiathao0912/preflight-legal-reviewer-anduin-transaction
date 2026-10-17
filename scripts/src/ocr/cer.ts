/**
 * ocr:cer - character error rate of the OCR text against the agent-transcribed ground truth
 * (Phase 06f, AC23 accuracy; REPORTED, NOT GATED). Offline: reads committed files only.
 *
 *   pnpm --filter @aduin/scripts ocr:cer
 *
 * Source per page: the shipped precomputed result (apps/web/public/precomputed/ocr) when present,
 * else a recording in fixtures/llm-recordings/ocr/{raw}.ocr2.*.json. Both texts are normalized
 * (lines trimmed, runs of spaces collapsed, NFC). Two numbers are reported: CER on the text with
 * `^{n}` markers kept (marker fidelity counts) and with markers removed.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OcrResultSchema } from '@aduin/core';
import { OCR_PRECOMPUTED_DIR, ocrPageKey, readPrecomputed } from '../precompute/precompute-ocr';
import { ROOT, scanPages } from '../samples/scan-set';

export const GROUND_TRUTH_DIR = join(ROOT, 'fixtures', 'scans-ground-truth');
export const OCR_RECORDINGS_DIR = join(ROOT, 'fixtures', 'llm-recordings', 'ocr');
const MARKER_RE = /[ \t]{0,8}\^\{\d{1,3}\}/g;

export function normalizeText(s: string): string {
  return s
    .normalize('NFC')
    .split(/\r?\n/)
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter((l) => l.length > 0)
    .join('\n');
}

export function stripMarkersText(s: string): string {
  return s.replace(MARKER_RE, '');
}

/** Levenshtein distance over code points (two rows, O(n*m) time, O(m) memory). */
export function editDistance(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) {
      cur[j] = Math.min(
        prev[j]! + 1,
        cur[j - 1]! + 1,
        prev[j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[y.length]!;
}

/** CER = edit distance / reference length (0 when both are empty). */
export function cer(reference: string, hypothesis: string): number {
  const ref = [...reference].length;
  if (ref === 0) return hypothesis.length === 0 ? 0 : 1;
  return editDistance(reference, hypothesis) / ref;
}

export interface CerRow {
  page: string;
  source: 'precomputed' | 'recording' | 'none';
  refChars: number;
  cer?: number;
  cerNoMarkers?: number;
}

function hypothesisFor(raw: string): { text: string; source: CerRow['source'] } | null {
  const p = scanPages().find((x) => x.raw === `${raw}.jpg`);
  if (p) {
    const pre = readPrecomputed(OCR_PRECOMPUTED_DIR, ocrPageKey(p.sourceHash, p.n - 1));
    if (pre)
      return {
        text: pre.result.pages[0]!.lines.map((l) => l.text).join('\n'),
        source: 'precomputed',
      };
  }
  if (existsSync(OCR_RECORDINGS_DIR)) {
    const f = readdirSync(OCR_RECORDINGS_DIR).find(
      (x) => x.startsWith(`${raw}.ocr2.`) && x.endsWith('.json'),
    );
    if (f) {
      const j = JSON.parse(readFileSync(join(OCR_RECORDINGS_DIR, f), 'utf8')) as {
        result?: unknown;
      };
      const r = OcrResultSchema.safeParse(j.result);
      if (r.success && r.data.pages[0])
        return { text: r.data.pages[0].lines.map((l) => l.text).join('\n'), source: 'recording' };
    }
  }
  return null;
}

export function cerReport(): CerRow[] {
  const rows: CerRow[] = [];
  for (const f of readdirSync(GROUND_TRUTH_DIR)
    .filter((x) => x.endsWith('.txt'))
    .sort()) {
    const raw = f.replace(/\.txt$/, '');
    const ref = normalizeText(readFileSync(join(GROUND_TRUTH_DIR, f), 'utf8'));
    const hyp = hypothesisFor(raw);
    if (!hyp) {
      rows.push({ page: raw, source: 'none', refChars: ref.length });
      continue;
    }
    const h = normalizeText(hyp.text);
    rows.push({
      page: raw,
      source: hyp.source,
      refChars: ref.length,
      cer: cer(ref, h),
      cerNoMarkers: cer(stripMarkersText(ref), stripMarkersText(h)),
    });
  }
  return rows;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rows = cerReport();
  console.log('ocr:cer (reported, not gated; ground truth is agent-transcribed)');
  for (const r of rows)
    console.log(
      r.cer === undefined
        ? `  ${r.page}: no OCR output yet`
        : `  ${r.page}: CER ${(r.cer * 100).toFixed(1)}% (markers removed ${(r.cerNoMarkers! * 100).toFixed(1)}%), ${r.refChars} chars, ${r.source}`,
    );
  const scored = rows.filter((r) => r.cer !== undefined);
  if (scored.length) {
    const tot = scored.reduce((a, r) => a + r.refChars, 0);
    const w = scored.reduce((a, r) => a + r.cer! * r.refChars, 0) / tot;
    console.log(`  weighted CER over ${scored.length} pages: ${(w * 100).toFixed(1)}%`);
  }
}
