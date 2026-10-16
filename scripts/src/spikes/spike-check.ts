// spike:check — verifies the spike REF has one verdict row per spike S1..S10.
// Usage: pnpm --filter @aduin/scripts spike:check [path/to/REF.md]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DEFAULT_REF = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_SPIKE-RESULTS_REF_17-10-26.md',
);
export const SPIKES = Array.from({ length: 10 }, (_, i) => `S${i + 1}`);
const HEADER = ['Spike', 'Verdict', 'Measured', 'Fallback adopted', 'Owner phase'];
const VERDICT =
  /^(PASS|PASS-WITH-RISK|FAIL\(fallback\)|INCONCLUSIVE-LOCAL|DEFERRED\([0-9]{2}[a-z]?\))$/;

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

/** Returns a list of problems; empty means the ledger is complete. */
export function checkSpikeRef(markdown: string): string[] {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => /^##\s+Spike verdicts\s*$/.test(l));
  if (start === -1) return ['missing "## Spike verdicts" section'];
  const end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  const table = lines
    .slice(start + 1, end === -1 ? undefined : end)
    .filter((l) => l.trim().startsWith('|'));
  const [head, , ...body] = table;
  if (!head || cells(head).join('|') !== HEADER.join('|'))
    return [`table header must be | ${HEADER.join(' | ')} |`];

  const problems: string[] = [];
  const seen = new Map<string, string[]>();
  for (const row of body) {
    const c = cells(row);
    const id = c[0] ?? '';
    if (seen.has(id)) problems.push(`${id}: duplicate row`);
    seen.set(id, c);
  }
  for (const id of SPIKES) {
    const c = seen.get(id);
    if (!c) {
      problems.push(`${id}: missing row`);
      continue;
    }
    const verdict = c[1] ?? '';
    if (!VERDICT.test(verdict)) problems.push(`${id}: unknown verdict "${verdict}"`);
    if ((verdict === 'PASS' || verdict === 'PASS-WITH-RISK') && !(c[2] ?? '').trim())
      problems.push(`${id}: Measured is empty for ${verdict}`);
  }
  for (const id of seen.keys())
    if (!SPIKES.includes(id)) problems.push(`${id}: unexpected spike id`);
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const path = resolve(process.argv[2] ?? DEFAULT_REF);
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    console.error(`spike:check: cannot read ${path}`);
    process.exit(1);
  }
  const problems = checkSpikeRef(text);
  for (const p of problems) console.error(`spike:check: ${p}`);
  console.log(
    problems.length ? `spike:check: FAILED (${problems.length})` : 'spike:check: OK (S1..S10)',
  );
  process.exit(problems.length ? 1 : 0);
}
