import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { docxToLines } from '../../src/adapters/docx';
import { htmlToLines } from '../../src/adapters/html';
import { buildDocGraph, runDeterministic } from '../../src/engine';
import type { Finding } from '../../src/findings/schema';
import type { DocGraph } from '../../src/graph/graph';
import type { Line } from '../../src/model/types';
import {
  analyzePackage,
  applyPackageDefinitions,
  buildPackageFacts,
  definitionSources,
  detectDocument,
  extractPrimaryFacts,
  resolveRoles,
  type PackageAnalysis,
  type PackageDocFormat,
  type PackageDocument,
  type PackageFacts,
} from '../../src/package/index';

/** Intake test helper: loads committed fixtures/package/** and runs the package pipeline. */
export const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
export const PKG = `${REPO}fixtures/package/`;

export interface Loaded {
  rel: string;
  name: string;
  format: PackageDocFormat;
  hash: string;
  bytes: number;
  lines: Line[];
}

const cache = new Map<string, Promise<Loaded>>();

/** Load a repo-relative html/htm/docx file into lines (cached per test file). */
export function load(rel: string): Promise<Loaded> {
  let hit = cache.get(rel);
  if (!hit) {
    hit = (async () => {
      const bytes = new Uint8Array(readFileSync(REPO + rel));
      const name = rel.split('/').pop()!;
      if (rel.endsWith('.docx')) {
        const r = await docxToLines(bytes);
        return {
          rel,
          name,
          format: 'docx' as const,
          hash: r.docHash,
          bytes: r.bytes,
          lines: r.lines,
        };
      }
      const r = htmlToLines(bytes);
      return {
        rel,
        name,
        format: 'html' as const,
        hash: r.docHash,
        bytes: r.bytes,
        lines: r.lines,
      };
    })();
    cache.set(rel, hit);
  }
  return hit;
}

export function graphOf(l: Loaded): DocGraph {
  return buildDocGraph(
    l.hash,
    l.lines,
    { bytes: l.bytes, adapter_ms: 0 },
    l.format === 'docx' ? 'docx' : 'html',
  );
}

export function factsOf(l: Loaded): PackageFacts {
  return buildPackageFacts({
    contentHash: l.hash,
    name: l.name,
    format: l.format,
    bytes: l.bytes,
    lines: l.lines,
  });
}

export function docOf(f: PackageFacts): PackageDocument {
  const d = detectDocument({
    name: f.name,
    titleLines: f.titleLines,
    headText: f.headText,
    headings: f.headings,
  });
  return {
    id: f.contentHash,
    name: f.name,
    ...d,
    confirmed: false,
    suggestionSource: 'rule',
    needsOcr: f.needsOcr,
    format: f.format,
    titleLines: f.titleLines,
  };
}

export function designFiles(id: string): string[] {
  return readdirSync(`${PKG}design/${id}`)
    .filter((f) => f.endsWith('.docx'))
    .sort()
    .map((f) => `fixtures/package/design/${id}/${f}`);
}

export const HARTWELL = {
  sub: 'fixtures/package/hartwell/fund-iii-subscription-agreement.html',
  lpa: 'fixtures/package/hartwell/northgate-lpa-definitions.docx',
  prior: 'fixtures/package/hartwell/fund-ii-subscription-agreement-prior.html',
};

export interface ExpectedFile {
  type: PackageDocument['type'];
  finalRole: PackageDocument['role'];
  mustBeLow: boolean;
  needsOcr?: boolean;
}
export interface ExpectedDesign {
  files: Record<string, ExpectedFile>;
  primary: string;
  notInPackage: string[];
  resolved: string[];
  quotes?: string[];
  annexCMentions?: number;
  definedInPackage?: string[];
  unverified?: string[];
  requests: string[];
  knownGaps: string[];
}
export interface ExpectedJson {
  hartwell: {
    files: Record<string, ExpectedFile>;
    references: Array<{
      label: string;
      family: string;
      withLpa: string;
      withoutLpa: string;
      mentions: number;
    }>;
    internalLabelsNotExternal: string[];
    terms: { withLpa: Record<string, string>; withoutLpaReason: string };
    findingsKept: string[];
    requests: string[];
    requestsWithoutLpa: string[];
    coverageLine: string;
  };
  design: Record<string, ExpectedDesign>;
  realFacts: Record<string, { type: string; mustBeLow: boolean }>;
  ngi: { files: Record<string, string>; recallNouns: string[]; exclusions: string[] };
}

export function expectedJson(): ExpectedJson {
  return JSON.parse(readFileSync(`${PKG}expected.json`, 'utf8')) as ExpectedJson;
}

/** Final analyst roles by file name (from expected.json). */
export function rolesOf(
  files: Record<string, ExpectedFile>,
): Record<string, PackageDocument['role']> {
  return Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.finalRole]));
}

export interface PipelineResult {
  docs: PackageDocument[];
  facts: PackageFacts[];
  findings: Finding[];
  analysis: PackageAnalysis;
}

/**
 * Full pipeline: facts + detection + roles; the analyst confirms every row (roles as given by
 * `roles` or resolved); the to-digitize document runs the engine with package definitions.
 */
export async function runPackage(
  rels: string[],
  opts: {
    roles?: Record<string, PackageDocument['role']>;
    confirmedTargets?: Record<string, string>;
  } = {},
): Promise<PipelineResult> {
  const loaded = await Promise.all(rels.map(load));
  const facts = loaded.map(factsOf);
  let docs = resolveRoles(facts.map(docOf)).map((d) => ({
    ...d,
    role: opts.roles?.[d.name] ?? d.role,
    confirmed: true,
    suggestionSource: 'analyst' as const,
  }));
  const primaryDoc = docs.find((d) => d.role === 'to_digitize');
  if (!primaryDoc) {
    return { docs, facts, findings: [], analysis: analyzePackage({ docs, facts, primary: null }) };
  }
  const l = loaded.find((x) => x.hash === primaryDoc.id)!;
  const g = graphOf(l);
  const srcIds = new Set(definitionSources(docs).map((d) => d.id));
  const defs = facts.filter((f) => srcIds.has(f.contentHash)).flatMap((f) => f.definitions);
  const applied = applyPackageDefinitions(runDeterministic(g), defs);
  const primary = extractPrimaryFacts(g, primaryDoc.id, applied.suppressed);
  docs = docs.map((d) => ({ ...d }));
  return {
    docs,
    facts,
    findings: applied.findings,
    analysis: analyzePackage({ docs, facts, primary, confirmedTargets: opts.confirmedTargets }),
  };
}
