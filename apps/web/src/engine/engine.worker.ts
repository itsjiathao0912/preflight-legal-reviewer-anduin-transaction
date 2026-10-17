/// <reference lib="webworker" />
/**
 * Engine worker: the ONLY module that imports htmlparser2-backed parsing, structure and detectors
 * from @aduin/core (import-graph test). Settings carry no firm id; findings return with quote_hash
 * and no fingerprint (Phase 01 Contracts v1).
 */
import * as Comlink from 'comlink';
import {
  buildAiCandidatesWithSites,
  buildDocGraph,
  buildStructureView,
  CoreError,
  detectFormat,
  htmlToLines,
  ISSUE_CLASS_LABELS,
  ocrToLines,
  pdfToLines,
  runDeterministic,
  selectInjectedRules,
  sensitiveSpans,
  verifyAiResult,
  type AiCandidateSite,
  type DocGraph,
  type Finding,
  type Line,
} from '@aduin/core';
import { IS_E2E } from '../e2e-flag';
import type {
  AnalyzeInput,
  BlockView,
  DocSource,
  OcrPageInput,
  OcrPageView,
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
  numberingNote?: (issueClass: string) => string | undefined,
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
    ...(() => {
      const note = numberingNote?.(f.issue_class);
      return note ? { numberingNote: note } : {};
    })(),
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
  /** candidate sites of the sent candidates (review M1: verify scopes quotes to them) */
  aiSites?: AiCandidateSite[];
  /** Phase 06: DOCX numbering label for numbering-dependent findings (AI findings too). */
  numberingNote?: (issueClass: string) => string | undefined;
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

function viewOf(
  g: DocGraph,
  pageConf?: Map<number, number>,
): { blocks: BlockView[]; sections: SectionView[] } {
  const blocks: BlockView[] = g.doc.blocks.map((b) => {
    const v: BlockView = {
      id: b.id,
      kind: b.kind,
      text: b.lines.map((l) => l.text).join(' '),
      section: b.section_path[0] ?? null,
    };
    const first = b.lines[0];
    if (first?.page !== undefined) {
      v.page = first.page;
      const c = pageConf?.get(first.page - 1);
      if (c !== undefined) v.conf = c;
    }
    if (first?.region) v.region = { ...first.region };
    return v;
  });
  const sections: SectionView[] = [];
  const seen = new Set<string>();
  for (const b of blocks) {
    if (!b.section || seen.has(b.section)) continue;
    seen.add(b.section);
    sections.push({ key: b.section, label: b.section, blockId: b.id });
  }
  return { blocks, sections };
}

/** Phase 06: what the read stage hands to the structurer. */
interface ReadOutcome {
  docHash: string;
  lines: Line[];
  bytes: number;
  adapter_ms: number;
  source: DocSource;
  pageCount?: number;
  scanPages?: number[];
  ocr?: OcrPageView[];
  /** 0-based page -> OCR page confidence. */
  pageConf?: Map<number, number>;
  reconstructedNumbering?: boolean;
  notice?: string;
  numberingNote?: (issueClass: string) => string | undefined;
}

/** Realm-safe Uint8Array check (structured clones and test realms differ). */
function isBytes(x: unknown): x is Uint8Array {
  return ArrayBuffer.isView(x) && Object.prototype.toString.call(x) === '[object Uint8Array]';
}

/** A bare Uint8Array is the Phase 03 HTML form. */
function normalizeInput(input: AnalyzeInput | Uint8Array): AnalyzeInput {
  return isBytes(input) ? { kind: 'html', bytes: input } : input;
}

function inputBytes(input: AnalyzeInput): number {
  if (input.kind === 'ocr') return typeof input.bytes === 'number' ? input.bytes : 0;
  return input.bytes.byteLength;
}

/** Extension + magic-byte check when a file name is known; a mismatch is refused (E9 polyglots). */
function checkFormat(input: Exclude<AnalyzeInput, { kind: 'ocr' }>): void {
  if (input.name === undefined) return;
  const d = detectFormat(input.name, input.bytes);
  if (d.format !== input.kind) {
    throw new CoreError('unsupported_type', 'The file content does not match its file type.');
  }
}

/**
 * pdf.js for the core PDF adapter (D4: one pdf.js ships). pdfjs-dist runs its "fake worker" in this
 * thread once `pdfjsWorker` is on globalThis, so no nested Worker is spawned.
 */
async function loadPdfjs(): Promise<unknown> {
  const [mod, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs'),
  ]);
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
  return mod;
}

function ocrPageViews(pages: readonly OcrPageInput[], pageCount: number): OcrPageView[] {
  const byIndex = new Map(pages.map((p) => [p.index, p] as const));
  const out: OcrPageView[] = [];
  for (let i = 0; i < pageCount; i++) {
    const p = byIndex.get(i);
    const v: OcrPageView = { index: i, state: p?.state ?? 'queued' };
    if (p?.reason) v.reason = p.reason.slice(0, 120);
    out.push(v);
  }
  return out;
}

/** Done OCR pages -> Lines (core OCR adapter), with confidence written into the page views. */
function ocrLines(
  pages: readonly OcrPageInput[],
  views: OcrPageView[],
): { lines: Line[]; pageConf: Map<number, number> } {
  const done = pages.filter((p) => p.state === 'done' && Array.isArray(p.lines));
  const r = ocrToLines(done.map((p) => ({ index: p.index, lines: p.lines ?? [] })));
  const pageConf = new Map<number, number>();
  for (const p of r.pages) {
    pageConf.set(p.index, p.conf);
    const v = views.find((x) => x.index === p.index);
    if (v) {
      v.conf = p.conf;
      v.lowConfidence = p.lowConfidence;
    }
  }
  return { lines: r.lines, pageConf };
}

function ocrNotice(views: readonly OcrPageView[]): string | undefined {
  const missing = views.filter((v) => v.state === 'failed' || v.state === 'unavailable').length;
  if (!missing) return undefined;
  return `Text not extracted for ${missing} of ${views.length} page${views.length === 1 ? '' : 's'}; those pages show as images only.`;
}

async function readInput(
  input: AnalyzeInput,
  progress: (sub: string) => void,
): Promise<ReadOutcome> {
  if (input.kind === 'html') {
    checkFormat(input);
    const r = htmlToLines(input.bytes);
    return { ...r, source: 'html' };
  }
  if (input.kind === 'docx') {
    checkFormat(input);
    const { docxToLines, numberingLabelFor } = await import('@aduin/core/docx');
    const r = await docxToLines(input.bytes);
    const reconstructed = r.reconstructedNumbering;
    return {
      docHash: r.docHash,
      lines: r.lines,
      bytes: r.bytes,
      adapter_ms: r.adapter_ms,
      source: 'docx',
      ...(reconstructed ? { reconstructedNumbering: true } : {}),
      ...(r.notice ? { notice: r.notice } : {}),
      numberingNote: (c) => numberingLabelFor(c, reconstructed),
    };
  }
  if (input.kind === 'pdf') {
    checkFormat(input);
    const r = await pdfToLines(input.bytes, {
      pdfjs: loadPdfjs,
      onPage: (done, total) => progress(`Reading page ${done} of ${total}`),
    });
    const out: ReadOutcome = {
      docHash: r.docHash,
      lines: r.lines,
      bytes: r.bytes,
      adapter_ms: r.adapter_ms,
      source: 'pdf',
      pageCount: r.pageCount,
      scanPages: [...r.scanPages],
    };
    if (r.scanPages.length) {
      const scan = new Set(r.scanPages);
      const given = (input.ocrPages ?? []).filter((p) => scan.has(p.index));
      const views = ocrPageViews(given, r.pageCount).filter((v) => scan.has(v.index));
      const o = ocrLines(given, views);
      // document order: text pages and OCR pages interleaved by page number
      out.lines = [...r.lines, ...o.lines].sort((a, b) => (a.page ?? 0) - (b.page ?? 0));
      out.ocr = views;
      out.pageConf = o.pageConf;
      const notice = ocrNotice(views);
      if (notice) out.notice = notice;
    }
    return out;
  }
  // OCR pages (scanned images; sample #9): the bytes never reach this worker, only OCR lines
  if (!/^[0-9a-f]{64}$/.test(input.sourceHash)) {
    throw new CoreError('invalid_request', 'The scan could not be identified.');
  }
  const pageCount = Math.max(0, Math.min(Math.floor(input.pageCount), 1000));
  const views = ocrPageViews(input.pages, pageCount);
  const o = ocrLines(input.pages, views);
  const notice = ocrNotice(views);
  return {
    docHash: input.sourceHash,
    lines: o.lines,
    bytes: inputBytes(input),
    adapter_ms: 0,
    source: 'ocr',
    pageCount,
    ocr: views,
    pageConf: o.pageConf,
    ...(notice ? { notice } : {}),
  };
}

export const api: EngineApi = {
  async analyze(input, settings, onStage) {
    const stages: StageReport[] = [];
    const report = (s: StageReport) => {
      const i = stages.findIndex((x) => x.id === s.id);
      if (i >= 0) stages[i] = s;
      else stages.push(s);
      onStage(s);
    };
    const result: EngineResult = {
      docHash: '',
      bytes: isBytes(input) ? input.byteLength : inputBytes(input),
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

    // Stage 1: read (format dispatch: HTML / PDF / DOCX / OCR pages)
    report({ id: 'read', state: 'running', sub: 'Reading the document' });
    let read: ReadOutcome;
    try {
      if (shouldFail(settings, 'read')) throw new Error('injected');
      read = await readInput(normalizeInput(input), (sub) =>
        report({ id: 'read', state: 'running', sub }),
      );
    } catch (e) {
      // CoreError messages are fixed plain-language strings from core (never document text)
      const msg = e instanceof CoreError ? e.message : 'the document could not be read';
      if (e instanceof CoreError) result.notice = e.message;
      return fail('read', msg);
    }
    const lines = read;
    result.docHash = read.docHash;
    result.bytes = read.bytes;
    result.source = read.source;
    if (read.pageCount !== undefined) result.pageCount = read.pageCount;
    if (read.scanPages) result.scanPages = read.scanPages;
    if (read.ocr) result.ocr = { pages: read.ocr };
    if (read.reconstructedNumbering) result.reconstructedNumbering = true;
    if (read.notice) result.notice = read.notice;
    report({ id: 'read', state: 'done', sub: `Done · ${lines.lines.length} lines` });
    if (lines.lines.length === 0 && read.source !== 'html') {
      // nothing to structure (e.g. every scan page failed OCR): page images only (AC24)
      for (const id of ['structure', 'checks'] as StageId[])
        report({ id, state: 'skipped', sub: 'Skipped · no text was extracted' });
      return result;
    }

    // Stage 2: structure (sections, references, graph)
    report({ id: 'structure', state: 'running', sub: 'Finding sections and references' });
    let g: DocGraph;
    try {
      if (shouldFail(settings, 'structure')) throw new Error('injected');
      g = buildDocGraph(
        lines.docHash,
        lines.lines,
        { bytes: lines.bytes, adapter_ms: lines.adapter_ms },
        read.source,
      );
      if (g.doc.stage_failed === 'structure') throw new Error('structure failed');
    } catch {
      result.blocks = lines.lines.map((l, i) => ({
        id: `l${i}`,
        kind: 'paragraph',
        text: l.text,
        section: null,
        ...(l.page !== undefined ? { page: l.page } : {}),
        ...(l.region ? { region: { ...l.region } } : {}),
      }));
      return fail('structure', 'showing the plain text without sections');
    }
    const v = viewOf(g, read.pageConf);
    const idx = new Map(v.blocks.map((b, i) => [b.id, i] as const));
    const numberingNote = read.numberingNote;
    retain(lines.docHash, {
      g,
      blocks: v.blocks,
      idx,
      ...(numberingNote ? { numberingNote } : {}),
    });
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
      result.findings = findings.map((f) => toView(f, v.blocks, idx, g, numberingNote));
      // Phase 05: graph-selected AI candidates (optional on the wire; the AI lane is skipped without them)
      try {
        const ai = buildAiCandidatesWithSites(g, findings);
        result.aiCandidates = ai.candidates;
        const kept = touch(lines.docHash);
        if (kept) kept.aiSites = ai.sites;
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
      // sites absent (candidate build failed) -> core recomputes them deterministically
      out = verifyAiResult(r.g, aiResult, {
        model,
        provenance,
        ...(r.aiSites ? { sites: r.aiSites } : {}),
      });
    } catch {
      return { ok: false, error: 'schema' };
    }
    if (!out.ok) return { ok: false, error: 'schema' };
    return {
      ok: true,
      findings: out.findings.map((f) => toView(f, r.blocks, r.idx, r.g, r.numberingNote)),
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
