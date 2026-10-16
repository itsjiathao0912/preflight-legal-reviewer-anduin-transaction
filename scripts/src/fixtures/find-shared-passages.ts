/**
 * find-shared-passages (Phase 02, C3): run the engine on samples #3-#6 with firm `partners-group`,
 * list fingerprints that occur in >= 2 documents (non-blocking first) and the pattern keys that
 * repeat across documents (M7). Read-only over the samples; prints a summary when run directly.
 * Engine imported by relative path (E7: @aduin/scripts has no @aduin/core dependency).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analyzeHtml,
  fingerprintFor,
  isBlocking,
  runDeterministic,
  type Finding,
} from '../../../packages/core/src/index';

export const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
export const RAW = join(ROOT, 'samples', 'sub-docs', 'raw');
export const DEMO_FIRM = 'partners-group';
export const DEMO_SAMPLES = ['03', '04', '05', '06'] as const;

export interface SampleFinding {
  sampleId: string;
  finding: Finding;
  fingerprint: string;
}

export function sampleFindings(sampleId: string): Finding[] {
  const file = readdirSync(RAW).find((f) => f.startsWith(`${sampleId}-`) && f.endsWith('.htm'));
  if (!file) throw new Error(`sample ${sampleId} not found`);
  return runDeterministic(analyzeHtml(new Uint8Array(readFileSync(join(RAW, file)))));
}

export interface SharedPassage {
  fingerprint: string;
  issue_class: string;
  pattern_key: string;
  quote: string;
  blocking: boolean;
  samples: string[];
}

/** Fingerprints present in >= 2 of #3-#6, non-blocking first, then by sample count and quote. */
export function findSharedPassages(firm = DEMO_FIRM): SharedPassage[] {
  const byFp = new Map<string, SharedPassage>();
  for (const id of DEMO_SAMPLES) {
    for (const f of sampleFindings(id)) {
      const fp = fingerprintFor(f, firm)!;
      const cur = byFp.get(fp) ?? {
        fingerprint: fp,
        issue_class: f.issue_class,
        pattern_key: f.pattern_key ?? f.detector_id,
        quote: f.quote,
        blocking: isBlocking(f.severity),
        samples: [],
      };
      if (!cur.samples.includes(id)) cur.samples.push(id);
      byFp.set(fp, cur);
    }
  }
  return [...byFp.values()]
    .filter((p) => p.samples.length >= 2)
    .sort(
      (a, b) =>
        Number(a.blocking) - Number(b.blocking) ||
        b.samples.length - a.samples.length ||
        (a.quote < b.quote ? -1 : a.quote > b.quote ? 1 : 0),
    );
}

/** Pattern keys of non-blocking findings that repeat across >= 3 of the demo samples (M7). */
export function sharedPatterns(): Array<{ pattern_key: string; samples: string[] }> {
  const by = new Map<string, Set<string>>();
  for (const id of DEMO_SAMPLES)
    for (const f of sampleFindings(id)) {
      if (isBlocking(f.severity) || !f.pattern_key) continue;
      by.set(f.pattern_key, (by.get(f.pattern_key) ?? new Set()).add(id));
    }
  return [...by.entries()]
    .filter(([, s]) => s.size >= 3)
    .map(([pattern_key, s]) => ({ pattern_key, samples: [...s].sort() }))
    .sort((a, b) => (a.pattern_key < b.pattern_key ? -1 : 1));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const shared = findSharedPassages();
  console.log(`shared fingerprints across #3-#6 (firm ${DEMO_FIRM}): ${shared.length}`);
  for (const p of shared)
    console.log(
      `  ${p.blocking ? 'blocking    ' : 'non-blocking'} ${p.pattern_key} samples=${p.samples.join(',')} "${p.quote.slice(0, 70)}"`,
    );
  console.log('repeating non-blocking patterns (>= 3 samples):');
  for (const p of sharedPatterns())
    console.log(`  ${p.pattern_key} samples=${p.samples.join(',')}`);
}
