// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(import.meta.dirname, '..', 'src');
const WORKER = 'engine/engine.worker.ts';

/** Main-thread value imports allowed from @aduin/core (types are erased and always allowed). */
const ALLOWED = new Set([
  'fingerprintFor',
  'resolveLabel',
  // Variance Phase 03: D5 scope rule shared with the Worker label call site
  'scopeMismatch',
  // Variance Phase 03: stub regression checks (same normalizer and statement as the Worker)
  'normalizeAssertionLabel',
  'describeAssertion',
  'mask',
  'limits',
  // firm list functions
  'LAW_FIRMS',
  'resolveFirm',
  'firmById',
  'normalizeFirmAlias',
  // memory contract values
  'MEMORY_LABELS',
  'REASON_CODES',
  'ActiveDecisionSchema',
  'SEVERITIES',
  // Phase 09: logic outline finalize (schema check, masked name, file name)
  'OutlineSchema',
  'outlineFilename',
  'maskOutlineName',
  // Phase 07c drift narrative (pure: masked candidates from a DiffResult, filtered reader)
  'buildDriftNarrativeCandidates',
  'readDriftNarrative',
  // Phase 08 counsel gate, query sheet, template / AI draft masking, metrics (S1-core names)
  'computeGate',
  'GATE_REASON_TEXT',
  'buildCounselSheet',
  'templateInterpretations',
  'templateQuestionText',
  'maskQuote',
  'maskAndClamp',
  'INTERPRETATION_MAX_CHARS',
  'computeMetrics',
  'sensitiveSpans',
  // Intake Phase 2: pure package module (parser-backed names stay worker-only)
  'analyzePackage',
  'packageRunReadiness',
  'packageGateReasons',
  'coverageLineText',
  'buildDocumentRequests',
  'eligibleBaselines',
  'detectDocument',
  'resolveRoles',
  'mergeSuggestion',
  'checkPackageLimits',
  'definitionSources',
  'DEFAULT_PACKAGE_POLICY',
  'PACKAGE_LIMITS',
  'PACKAGE_DOC_TYPES',
  'PACKAGE_DOC_ROLES',
  'PackageAnalysisSchema',
  // review Minor 6: stored package rows are validated before restore (pure zod schemas)
  'PackageDocumentSchema',
  'PackageFactsSchema',
]);

function files(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}

interface Imp {
  file: string;
  from: string;
  typeOnly: boolean;
  names: { name: string; type: boolean }[];
}

function imports(file: string): Imp[] {
  const src = readFileSync(file, 'utf8');
  const out: Imp[] = [];
  for (const m of src.matchAll(/import\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
    const clause = m[2]!;
    const names: Imp['names'] = [];
    const brace = clause.match(/\{([\s\S]*)\}/);
    if (brace) {
      for (const part of brace[1]!.split(',')) {
        const t = part.trim();
        if (!t) continue;
        const type = t.startsWith('type ');
        names.push({
          name: t
            .replace(/^type\s+/, '')
            .split(/\s+as\s+/)[0]!
            .trim(),
          type,
        });
      }
    }
    if (/\*\s+as\s+/.test(clause)) names.push({ name: '*', type: false });
    const def = clause
      .replace(/\{[\s\S]*\}/, '')
      .replace(/,/g, '')
      .trim();
    if (def && !def.startsWith('*')) names.push({ name: 'default', type: false });
    out.push({ file: relative(SRC, file), from: m[3]!, typeOnly: !!m[1], names });
  }
  for (const m of src.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    out.push({
      file: relative(SRC, file),
      from: m[1]!,
      typeOnly: false,
      names: [{ name: '*', type: false }],
    });
  }
  for (const m of src.matchAll(/^import\s+['"]([^'"]+)['"]/gm)) {
    out.push({ file: relative(SRC, file), from: m[1]!, typeOnly: false, names: [] });
  }
  return out;
}

describe('import-graph', () => {
  const all = files(SRC).flatMap(imports);

  it('should run document parsing in a dedicated worker: only engine.worker.ts imports htmlparser2 or core parse internals', () => {
    const parsers = all.filter((i) => /^htmlparser2|^@aduin\/core\/src\//.test(i.from));
    expect(parsers.filter((i) => i.file !== WORKER)).toEqual([]);
    const worker = all.filter((i) => i.file === WORKER && i.from === '@aduin/core');
    const names = worker.flatMap((i) => i.names.map((n) => n.name));
    expect(names).toEqual(
      expect.arrayContaining(['htmlToLines', 'buildDocGraph', 'runDeterministic']),
    );
  });

  it('main-thread code imports only the allow-listed @aduin/core values', () => {
    const bad = all
      .filter((i) => i.file !== WORKER && i.from === '@aduin/core' && !i.typeOnly)
      .flatMap((i) =>
        i.names.filter((n) => !n.type && !ALLOWED.has(n.name)).map((n) => `${i.file}: ${n.name}`),
      );
    expect(bad).toEqual([]);
  });

  it('the worker is created from engine/client.ts only and nothing else imports engine.worker', () => {
    const direct = all.filter((i) => /engine\.worker/.test(i.from));
    expect(direct).toEqual([]);
    const client = readFileSync(join(SRC, 'engine', 'client.ts'), 'utf8');
    expect(client).toMatch(/new Worker\(new URL\('\.\/engine\.worker\.ts', import\.meta\.url\)/);
  });

  it('uses fingerprintFor on the main thread (fingerprint flow)', () => {
    const fp = all.filter(
      (i) =>
        i.file === 'memory/fingerprintFindings.ts' &&
        i.names.some((n) => n.name === 'fingerprintFor'),
    );
    expect(fp.length).toBe(1);
  });
});
