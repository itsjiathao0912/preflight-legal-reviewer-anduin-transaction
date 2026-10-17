/// <reference lib="webworker" />
/**
 * Engine worker: the ONLY module that imports htmlparser2-backed parsing, structure and detectors
 * from @aduin/core (import-graph test). Settings carry no firm id; findings return with quote_hash
 * and no fingerprint (Phase 01 Contracts v1).
 */
import * as Comlink from 'comlink';
import {
  buildAiCandidates,
  buildDocGraph,
  buildStructureView,
  htmlToLines,
  ISSUE_CLASS_LABELS,
  runDeterministic,
  selectInjectedRules,
  sensitiveSpans,
  verifyAiResult,
  type DocGraph,
  type Finding,
  type HtmlAdapterResult,
} from '@aduin/core';
import { IS_E2E } from '../e2e-flag';
import type {
  BlockView,
  EngineApi,
  EngineResult,
  EngineSettings,
  FindingLocator,
  FindingView,
  SectionView,
  StageId,
  StageReport,
} from './types';

function shouldFail(settings: EngineSettings, stage: StageId): boolean {
  if (IS_E2E) {
    // __aduinE2E stage-failure hook (compiled only in the e2e build)
    return settings.e2eFailStage === stage;
  }
  return false;
}

function sectionNumber(label: string | undefined): string {
  const m = label?.match(/^(\d+[A-Z]?)\b/);
  return m ? m[1]! : '';
}

function firstSentence(s: string): string {
  const m = s.match(/^(.+?[.!?])(\s|$)/);
  const t = (m ? m[1]! : s).trim();
  return t.length > 160 ? `${t.slice(0, 157)}…` : t;
}

function foundOf(f: Finding): string | null {
  for (const k of ['reference', 'found', 'used_term', 'label', 'term']) {
    const v = f.detail.facts[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

/**
 * U1 locator: the finding's full section path and its paragraph number (1-based, non-heading blocks)
 * inside the innermost section that contains it.
 */
function locatorOf(f: Finding, g: DocGraph | null, order: number): FindingLocator {
  const path = f.section_path;
  let paragraph = 1;
  if (g) {
    const key = path.join('\u0000');
    let n = 0;
    const blocks = g.doc.blocks;
    for (let i = 0; i <= order && i < blocks.length; i++) {
      const b = blocks[i]!;
      if (b.kind === 'heading' || b.section_path.join('\u0000') !== key) continue;
      n++;
    }
    paragraph = Math.max(1, n);
  }
  return { path: [...path], paragraph };
}

function toView(
  f: Finding,
  blocks: BlockView[],
  indexById: Map<string, number>,
  g: DocGraph | null = null,
): FindingView {
  const order = indexById.get(f.anchor.blockId) ?? 0;
  const block = blocks[order];
  const sec = f.section_path[0];
  const num = sectionNumber(sec);
  let sensitive: { start: number; end: number }[] = [];
  if (f.issue_class === 'sensitive_data' && block) {
    const slice = block.text.slice(f.anchor.offsetStart, f.anchor.offsetEnd);
    sensitive = sensitiveSpans(slice).map((s) => ({
      start: s.start + f.anchor.offsetStart,
      end: s.end + f.anchor.offsetStart,
    }));
  }
  return {
    ...f,
    classLabel: ISSUE_CLASS_LABELS[f.issue_class],
    title: firstSentence(f.detail.explanation),
    ref: num ? `§${num}` : '',
    loc: num ? `Section ${num}` : sec ? sec : 'Before the first section',
    found: foundOf(f),
    sensitive,
    order,
    locator: locatorOf(f, g, order),
  };
}

/**
 * Retained analyzed graphs for the AI lane (G13): bounded LRU of 2 keyed by docHash, so memory holds
 * at most two documents. A third analysis evicts the least recently used one; dispose clears all.
 */
interface Retained {
  g: DocGraph;
  blocks: BlockView[];
  idx: Map<string, number>;
}
const RETAIN_MAX = 2;
const retained = new Map<string, Retained>();

function retain(docHash: string, r: Retained): void {
  retained.delete(docHash);
  retained.set(docHash, r);
  while (retained.size > RETAIN_MAX) {
    const oldest = retained.keys().next().value;
    if (oldest === undefined) break;
    retained.delete(oldest);
  }
}

function touch(docHash: string): Retained | undefined {
  const r = retained.get(docHash);
  if (r) {
    retained.delete(docHash);
    retained.set(docHash, r);
  }
  return r;
}

function plainStrings(xs: unknown): string[] {
  return Array.isArray(xs) ? xs.filter((x): x is string => typeof x === 'string') : [];
}

function viewOf(g: DocGraph): { blocks: BlockView[]; sections: SectionView[] } {
  const blocks: BlockView[] = g.doc.blocks.map((b) => ({
    id: b.id,
    kind: b.kind,
    text: b.lines.map((l) => l.text).join(' '),
    section: b.section_path[0] ?? null,
  }));
  const sections: SectionView[] = [];
  const seen = new Set<string>();
  for (const b of blocks) {
    if (!b.section || seen.has(b.section)) continue;
    seen.add(b.section);
    sections.push({ key: b.section, label: b.section, blockId: b.id });
  }
  return { blocks, sections };
}

export const api: EngineApi = {
  async analyze(bytes, settings, onStage) {
    const stages: StageReport[] = [];
    const report = (s: StageReport) => {
      const i = stages.findIndex((x) => x.id === s.id);
      if (i >= 0) stages[i] = s;
      else stages.push(s);
      onStage(s);
    };
    const result: EngineResult = {
      docHash: '',
      bytes: bytes.byteLength,
      blocks: [],
      sections: [],
      findings: [],
      stages,
      failedStage: null,
    };
    const fail = (id: StageId, label: string): EngineResult => {
      result.failedStage = id;
      report({ id, state: 'failed', sub: `Failed · ${label}` });
      for (const rest of ['structure', 'checks'] as StageId[]) {
        if (!stages.some((s) => s.id === rest)) {
          report({ id: rest, state: 'skipped', sub: 'Skipped · an earlier stage failed' });
        }
      }
      return result;
    };

    // Stage 1: read (HTML adapter)
    report({ id: 'read', state: 'running', sub: 'Reading the document' });
    let lines: HtmlAdapterResult;
    try {
      if (shouldFail(settings, 'read')) throw new Error('injected');
      lines = htmlToLines(bytes);
    } catch {
      return fail('read', 'the document could not be read');
    }
    result.docHash = lines.docHash;
    report({ id: 'read', state: 'done', sub: `Done · ${lines.lines.length} lines` });

    // Stage 2: structure (sections, references, graph)
    report({ id: 'structure', state: 'running', sub: 'Finding sections and references' });
    let g: DocGraph;
    try {
      if (shouldFail(settings, 'structure')) throw new Error('injected');
      g = buildDocGraph(lines.docHash, lines.lines, {
        bytes: lines.bytes,
        adapter_ms: lines.adapter_ms,
      });
      if (g.doc.stage_failed === 'structure') throw new Error('structure failed');
    } catch {
      result.blocks = lines.lines.map((l, i) => ({
        id: `l${i}`,
        kind: 'paragraph',
        text: l.text,
        section: null,
      }));
      return fail('structure', 'showing the plain text without sections');
    }
    const v = viewOf(g);
    const idx = new Map(v.blocks.map((b, i) => [b.id, i] as const));
    retain(lines.docHash, { g, blocks: v.blocks, idx });
    result.blocks = v.blocks;
    result.sections = v.sections;
    report({
      id: 'structure',
      state: 'done',
      sub: `Done · ${v.sections.length} sections, ${g.structure.references.length} references`,
    });

    // Stage 3: deterministic checks
    report({ id: 'checks', state: 'running', sub: 'Running rule checks' });
    try {
      if (shouldFail(settings, 'checks')) throw new Error('injected');
      const findings = runDeterministic(g);
      result.findings = findings.map((f) => toView(f, v.blocks, idx, g));
      // Phase 05: graph-selected AI candidates (optional on the wire; the AI lane is skipped without them)
      try {
        result.aiCandidates = buildAiCandidates(g, findings);
      } catch (e) {
        console.warn('[engine] ai_candidates_failed', e instanceof Error ? e.name : 'unknown');
      }
    } catch {
      return fail('checks', 'no rule findings for this document');
    }
    const n = result.findings.length;
    // Phase 02: the #structure view model (pure core function, worker only; optional on the wire)
    try {
      result.structure = buildStructureView(g, result.findings);
    } catch (e) {
      // the Structure view shows its empty state; log a code only, never document text (F8)
      console.warn('[engine] structure_view_failed', e instanceof Error ? e.name : 'unknown');
    }
    report({ id: 'checks', state: 'done', sub: `Done · ${n} finding${n === 1 ? '' : 's'}` });
    return result;
  },

  // Phase 05 verify chain (G12): schema -> quote locate -> snapToSentence -> severity cap -> mask,
  // all in core verifyAiResult; the main thread only receives plain FindingViews.
  async verifyAi(aiResult, docHash, injectedRuleTexts, ctx) {
    const sel = selectInjectedRules(plainStrings(injectedRuleTexts));
    const r = touch(docHash);
    if (!r) return { ok: false, error: 'doc_not_retained' };
    const provenance = ctx?.provenance === 'cache' ? 'cache' : 'fresh';
    const model = typeof ctx?.model === 'string' && ctx.model ? ctx.model.slice(0, 120) : 'unknown';
    let out: ReturnType<typeof verifyAiResult>;
    try {
      out = verifyAiResult(r.g, aiResult, { model, provenance });
    } catch {
      return { ok: false, error: 'schema' };
    }
    if (!out.ok) return { ok: false, error: 'schema' };
    return {
      ok: true,
      findings: out.findings.map((f) => toView(f, r.blocks, r.idx, r.g)),
      rejected: out.rejected.map((x) => ({
        ...(x.candidate_id !== undefined ? { candidate_id: x.candidate_id } : {}),
        reason: x.reason,
      })),
      rulesHash8: sel.hash8,
      rulesApplied: sel.applied,
      rulesTotal: sel.total,
    };
  },

  async rulesHash8(ruleTexts) {
    return selectInjectedRules(plainStrings(ruleTexts)).hash8;
  },

  async dispose() {
    retained.clear();
  },
};

Comlink.expose(api);
