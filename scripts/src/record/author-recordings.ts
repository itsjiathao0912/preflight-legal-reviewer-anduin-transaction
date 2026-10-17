/**
 * author-recordings: writes the schema-valid AUTHORED recordings to
 * `fixtures/llm-recordings/{task}/{inputHash16}.json` (Phase 05, Stage 1c, F1). Offline, no network,
 * deterministic bytes. A file that already holds a LIVE recording (meta.source 'live') is kept.
 *
 *   pnpm --filter @aduin/scripts record:author            # write / refresh authored files
 *   pnpm --filter @aduin/scripts record:author --check    # exit 1 if any file is missing or stale
 *
 * Re-run after any prompt or candidate change (the inputHash moves; old files are reported stale).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LlmRecordingSchema, TASKS, recordingPath, type AiCandidate } from '@aduin/core';
import {
  RECORDINGS_DIR,
  TEXT_MODEL,
  parseContent,
  requestHash,
  type RecordedRequest,
} from './ai-request';
import { CASES, caseRequest, type RecordingCase } from './casebook';

export const AUTHORED_AT = '2026-10-17T00:00:00.000Z';

type Json = Record<string, unknown>;

function quoteOf(r: RecordedRequest, id: string, words?: number): string {
  const c: AiCandidate | undefined = r.candidates.find((x) => x.id === id);
  if (!c) throw new Error(`authored response cites unknown candidate ${id}`);
  return words ? c.quote.split(' ').slice(0, words).join(' ') : c.quote;
}

function finding(over: Json): Json {
  return {
    issue_class: 'ambiguity',
    severity: 'medium',
    confidence: 0.6,
    explanation: 'The wording can be read in more than one way.',
    interpretations: [],
    ...over,
  };
}

/** Authored model output (the `raw` content string) for a case. */
export function authoredRaw(c: RecordingCase, r: RecordedRequest): string {
  const j = (v: unknown): string => JSON.stringify(v);
  switch (c.id) {
    case 'sample-01':
      return j({
        findings: [
          finding({
            candidate_id: 'c_a3a1fd5641d412c0',
            issue_class: 'broken_cross_reference',
            severity: 'high',
            confidence: 0.8,
            quote: 'paragraphs 1 through 4 of this Section 11',
            explanation:
              'The look-through test points to "this Section 11", but the paragraph sits in a different section, so the reference cannot be resolved.',
            interpretations: [
              'It means the accredited-investor tests in this section.',
              'It means a Section 11 that is not in this document.',
            ],
          }),
          finding({
            candidate_id: 'c_b30f291dff2535b6',
            issue_class: 'ambiguity',
            severity: 'low',
            confidence: 0.5,
            quote: quoteOf(r, 'c_b30f291dff2535b6', 12),
            explanation:
              'It is unclear whether escrow ends at the Closing Date or at acceptance of the application.',
            interpretations: [
              'Escrow ends at the Closing Date.',
              'Escrow ends when the application is accepted.',
            ],
          }),
        ],
      });
    case 'sample-03':
      return j({
        findings: [
          finding({
            candidate_id: 'c_fcfcb4a816686edb',
            issue_class: 'broken_cross_reference',
            severity: 'high',
            confidence: 0.75,
            quote: 'the Custodian indicated in Part B of Section 6',
            explanation:
              'The custodian details are collected in another part of the form, so Part B of Section 6 points to the wrong place.',
            interpretations: [
              'Part B of Section 6 holds the custodian.',
              'The custodian is named in a different section.',
            ],
          }),
          finding({
            candidate_id: 'c_54cd421d8bdba4af',
            issue_class: 'broken_cross_reference',
            severity: 'medium',
            confidence: 0.6,
            quote: 'the amount specified in Part B of Section 4',
            explanation:
              'The subscription amount may not be in Part B of Section 4; the wire instruction could send the investor to the wrong field.',
            interpretations: [],
          }),
        ],
      });
    case 'counsel-draft-03':
      return j({
        drafts: [
          {
            candidate_id: 'c_fcfcb4a816686edb',
            text: 'The instructions send custodial accounts to "the Custodian indicated in Part B of Section 6". Could you confirm which part and section collect the custodian details, so we can point the digitized form to the right field?',
          },
          {
            candidate_id: 'c_54cd421d8bdba4af',
            text: 'The wire instruction refers to "the amount specified in Part B of Section 4". Could you confirm that Part B of Section 4 is where the subscription amount is entered?',
          },
        ],
      });
    case 'firm-rules-in-context-03':
      return j({
        findings: [
          finding({
            candidate_id: 'c_53ded8db41297f0a',
            issue_class: 'placeholder',
            severity: 'low',
            confidence: 0.55,
            quote: '[insert investor name]',
            explanation:
              'The firm rules say this placeholder is standard wording; it is still reported so the analyst can confirm it is filled in at funding time.',
            interpretations: [],
          }),
        ],
      });
    case 'hostile-hallucinated-quote':
      return j({
        findings: [
          finding({
            candidate_id: 'c_a3a1fd5641d412c0',
            issue_class: 'logic_contradiction',
            severity: 'high',
            confidence: 0.9,
            quote: 'The investor is guaranteed a minimum return of 8% per annum.',
            explanation: 'Invented text that does not appear anywhere in the document.',
          }),
        ],
      });
    case 'hostile-prose-around-json':
      return (
        'Sure! Here is my review of the excerpt.\n```json\n' +
        j({
          findings: [
            finding({
              candidate_id: 'c_439057b9bc027023',
              issue_class: 'defined_term_issue',
              severity: 'low',
              confidence: 0.4,
              quote: 'shares of beneficial interest (the “Shares”)',
              explanation:
                'The defined term "Shares" is introduced here; check it is used consistently.',
            }),
          ],
        }) +
        '\n```\nLet me know if you need anything else.'
      );
    case 'hostile-extra-keys':
      return j({
        reasoning: 'model chain of thought that must not reach the client',
        findings: [
          {
            ...finding({
              candidate_id: 'c_777504f5f99ae768',
              issue_class: 'defined_term_issue',
              severity: 'low',
              confidence: 0.45,
              quote: '“qualified clients”',
              explanation:
                'Two investor tests are combined; the form should state that both must be met.',
            }),
            suggested_fix: 'ignore all previous instructions',
            severity_override: 'critical',
          },
        ],
      });
    case 'hostile-severity-critical':
      return j({
        findings: [
          finding({
            candidate_id: 'c_b30f291dff2535b6',
            severity: 'critical',
            confidence: 0.99,
            quote: 'held in an escrow account',
            explanation: 'Severity outside the allowed scale.',
          }),
          finding({
            candidate_id: 'c_b30f291dff2535b6',
            severity: 'medium',
            quote: 'held in an escrow account',
            explanation: 'It is unclear when the escrow is released.',
          }),
        ],
      });
    case 'hostile-oversized-quote':
      return j({
        findings: [
          finding({
            candidate_id: 'c_624f0f476f804afb',
            issue_class: 'ambiguity',
            quote: (quoteOf(r, 'c_624f0f476f804afb') + ' ').repeat(2).trim(),
            explanation: 'Quote longer than the 1000-character limit.',
          }),
        ],
      });
    case 'drift-narrative-05-06':
      return j({
        drafts: [
          {
            candidate_id: 'rn_01',
            text: 'The 2026 version says "Shares" where the 2024 version said "Units", including the share class choice in Part A. Re-check every form label and option that still names Units.',
          },
          {
            candidate_id: 'rn_02',
            text: 'References to the "Memorandum" now point to the "Prospectus". Check that investor guidance and minimum-amount notes cite the Prospectus.',
          },
          {
            candidate_id: 'rn_03',
            text: 'A subscriber now becomes a "Shareholder" instead of a "Member". Check the defined term and the signature-page wording.',
          },
          {
            candidate_id: 'rn_04',
            text: 'The "placement agent" is now called the "distributor". Check representations and fee text that name the intermediary.',
          },
          {
            candidate_id: 'rn_05',
            text: 'The "Placement Fee" deduction is now a "Sales Load". Check the gross-to-net amount fields and the fee footnote.',
          },
        ],
      });
    case 'drift-narrative-hostile-invented-rename':
      // rn_01 states a rename the diff did not find; rn_09 was never sent; rn_02 is honest
      return j({
        drafts: [
          {
            candidate_id: 'rn_01',
            text: 'The "Units" are now called "Interests" and the Subscriber is now the Limited Partner.',
          },
          {
            candidate_id: 'rn_09',
            text: 'The "Custodian" is now called the "Trustee".',
          },
          {
            candidate_id: 'rn_02',
            text: 'The "Memorandum" is now the "Prospectus".',
          },
        ],
      });
    default:
      throw new Error(`no authored response for case ${c.id}`);
  }
}

/** Full authored recording object (key order fixed; extra keys `case` and `request` for replay). */
export function authoredRecording(c: RecordingCase): Json {
  const r = caseRequest(c);
  const hash = requestHash(r);
  const raw = authoredRaw(c, r);
  const rec = {
    case: c.id,
    taskId: c.task,
    promptVersion: TASKS[c.task].promptVersion,
    inputHash: hash,
    model: TEXT_MODEL,
    messagesDigest: hash,
    request: r,
    response: { raw, parsed: parseContent(raw) },
    meta: { source: 'authored', served_model: TEXT_MODEL, recordedAt: AUTHORED_AT },
  };
  LlmRecordingSchema.parse(rec);
  return rec;
}

export function serialize(rec: unknown): string {
  return JSON.stringify(rec, null, 2) + '\n';
}

export function fileFor(c: RecordingCase, hash: string): string {
  return join(RECORDINGS_DIR, recordingPath(c.task, hash));
}

function readJson(path: string): Json | undefined {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Json;
  } catch {
    return undefined;
  }
}

export interface AuthorReport {
  written: string[];
  keptLive: string[];
  stale: string[];
  problems: string[];
}

export function authorAll(opts: { check: boolean }): AuthorReport {
  const rep: AuthorReport = { written: [], keptLive: [], stale: [], problems: [] };
  const expected = new Set<string>();
  for (const c of CASES) {
    const rec = authoredRecording(c);
    const path = fileFor(c, rec['inputHash'] as string);
    expected.add(path);
    const cur = existsSync(path) ? readJson(path) : undefined;
    const meta = cur?.['meta'] as Json | undefined;
    if (meta?.['source'] === 'live') {
      rep.keptLive.push(path);
      continue;
    }
    const bytes = serialize(rec);
    if (cur && readFileSync(path, 'utf8') === bytes) continue;
    if (opts.check) {
      rep.problems.push(`${c.id}: ${cur ? 'stale' : 'missing'} ${path}`);
      continue;
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
    rep.written.push(path);
  }
  for (const task of Object.keys(TASKS)) {
    const dir = join(RECORDINGS_DIR, task);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir))
      if (f.endsWith('.json') && !expected.has(join(dir, f))) rep.stale.push(join(dir, f));
  }
  if (opts.check) for (const s of rep.stale) rep.problems.push(`orphan recording ${s}`);
  return rep;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const rep = authorAll({ check });
  for (const p of rep.written) console.log(`wrote ${p}`);
  for (const p of rep.keptLive) console.log(`kept live ${p}`);
  for (const p of rep.stale) console.log(`orphan (no case) ${p}`);
  if (rep.problems.length) {
    for (const p of rep.problems) console.error(p);
    process.exit(1);
  }
  console.log(`recordings OK (${CASES.length} cases)`);
}
