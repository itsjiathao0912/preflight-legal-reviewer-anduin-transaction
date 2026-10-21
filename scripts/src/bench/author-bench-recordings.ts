// `pnpm --filter @aduin/scripts bench:author [--check]` — writes the authored reference-target
// recordings for the three verified wrong-target docs (Onex, LAGO, Keystone) into
// fixtures/defect-bench/recordings/. The input hash covers every pair plus the playbook, so the
// files cannot be hand-typed and go stale when either changes. Throws when no built pair has a
// pointer sentence containing the ground-truth anchor (an authored answer would be vacuous).
// Authored answers prove plumbing (pair builder + verify chain on the real HTML), not model skill.
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TASKS } from '@aduin/core';
import {
  analyzeDoc,
  BenchRecordingSchema,
  CORPUS_DIR,
  defaultReadDoc,
  dirRecordingStore,
  loadGroundTruth,
  RECORDINGS_DIR,
  recordingFile,
  sentenceHasAnchor,
  type BenchRecording,
} from './bench-defects';

const RECORDED_AT = '2026-10-22';

export function authorRecordings(corpusDir = CORPUS_DIR): { name: string; rec: BenchRecording }[] {
  const gt = loadGroundTruth();
  const out: { name: string; rec: BenchRecording }[] = [];
  for (const d of gt.docs) {
    const wanted = d.defects.filter((x) => x.expect === 'reference-target');
    if (wanted.length === 0) continue;
    const bytes = defaultReadDoc(d, corpusDir);
    if (!bytes)
      throw new Error(`corpus not found for ${d.file}: seed fixtures/defect-bench/corpus`);
    const a = analyzeDoc(bytes);
    const findings = wanted.map((x) => {
      const anchor = x.anchors[0]!;
      const pair = a.pairs.find((p) => sentenceHasAnchor(p.quote.split('\n')[0]!, anchor));
      if (!pair) throw new Error(`no pair pointer contains the ${x.id} anchor in ${d.file}`);
      return {
        candidate_id: pair.id,
        issue_class: 'broken_cross_reference',
        severity: 'high',
        confidence: 0.8,
        quote: anchor,
        explanation: `Authored bench answer for ${x.id}: ${x.why}.`,
        interpretations: [],
      };
    });
    const parsed = { findings };
    const rec: BenchRecording = {
      doc: d.file,
      taskId: 'reference-target',
      promptVersion: TASKS['reference-target'].promptVersion,
      inputHash: a.hash,
      model: 'authored',
      messagesDigest: a.hash,
      response: { raw: JSON.stringify(parsed), parsed },
      meta: { source: 'authored', served_model: 'authored', recordedAt: RECORDED_AT },
    };
    out.push({ name: recordingFile(a.hash, 'authored'), rec });
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const check = process.argv.includes('--check');
  try {
    const want = authorRecordings();
    const names = new Set(want.map((w) => w.name));
    const authoredOnDisk = existsSync(RECORDINGS_DIR)
      ? readdirSync(RECORDINGS_DIR).filter((f) => f.endsWith('.json') && !f.endsWith('.live.json'))
      : [];
    const orphans = authoredOnDisk.filter((f) => !names.has(f));
    let bad = 0;
    for (const w of want) {
      const f = join(RECORDINGS_DIR, w.name);
      const same =
        existsSync(f) &&
        JSON.stringify(BenchRecordingSchema.parse(JSON.parse(readFileSync(f, 'utf8')))) ===
          JSON.stringify(BenchRecordingSchema.parse(w.rec));
      if (check) {
        if (!same) {
          bad++;
          console.log(`stale or missing ${w.name} (${w.rec.doc})`);
        }
      } else if (!same) {
        dirRecordingStore().write(w.name, w.rec);
        console.log(`wrote ${w.name} (${w.rec.doc})`);
      }
    }
    for (const o of orphans) {
      if (check) {
        bad++;
        console.log(`orphan ${o}`);
      } else {
        rmSync(join(RECORDINGS_DIR, o));
        console.log(`removed orphan ${o}`);
      }
    }
    console.log(
      bad ? `bench recordings: ${bad} problem(s)` : `bench recordings OK (${want.length})`,
    );
    process.exit(bad ? 1 : 0);
  } catch (e) {
    console.error(`bench:author failed: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
