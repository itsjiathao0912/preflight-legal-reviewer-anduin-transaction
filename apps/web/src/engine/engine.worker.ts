/// <reference lib="webworker" />
/**
 * Engine worker: the ONLY module that imports htmlparser2-backed parsing, structure and detectors
 * from @aduin/core (import-graph test). Settings carry no firm id; findings return with quote_hash
 * and no fingerprint (Phase 01 Contracts v1).
 */
import * as Comlink from 'comlink';
import {
  buildDocGraph,
  buildStructureView,
  htmlToLines,
  ISSUE_CLASS_LABELS,
  runDeterministic,
  sensitiveSpans,
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

function toView(f: Finding, blocks: BlockView[], indexById: Map<string, number>): FindingView {
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
  };
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

const api: EngineApi = {
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
      const idx = new Map(v.blocks.map((b, i) => [b.id, i] as const));
      result.findings = findings.map((f) => toView(f, v.blocks, idx));
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
};

Comlink.expose(api);
