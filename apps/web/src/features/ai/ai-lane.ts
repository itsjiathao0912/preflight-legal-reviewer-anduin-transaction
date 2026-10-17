import { useEffect } from 'react';
import { create } from 'zustand';
import type { AiCandidate } from '@aduin/core';
import { apiBase, apiEnabled, onApiBaseChange } from '../../api/base';
import { memoryApi } from '../../api/client';
import { analyzeInWorker, rulesHash8InWorker, verifyAiInWorker } from '../../engine/client';
import type {
  EngineResult,
  FindingView,
  VerifyAiContext,
  VerifyAiResponse,
} from '../../engine/types';
import { useSession } from '../../state/session';
import { BANNERS, bannerFor, resumeAt, type BannerKey } from './banner-map';
import { loadPrecomputed } from './precomputed';
import { requestAi } from './stream-client';

/**
 * AI lane state machine (Phase 05). One lane per open document.
 *
 *   off             AI switch is off (no lookup, no call)
 *   idle            no API in this build (API base ''): fails soft, no banner, no network
 *   pending         lookup or /api/ai call in flight
 *   cache | fresh   verified AI findings are shown (static precomputed / Worker cache hit = cache)
 *   not_precomputed bundled sample without a precomputed file: explicit "Run AI on this sample"
 *   skipped         downgrade (quota, budget, rate, verification, rules) or nothing to review
 *   unavailable     the call failed (provider error, unusable answer, dropped stream): manual Retry
 *
 * Lookup order: static `/precomputed/{docHash}.{rulesHash8}.json` -> `/api/ai`. Bundled samples
 * never call `/api/ai` on open. Every AI result is verified in the engine worker (quote must exist,
 * sentence snap, severity cap, mask) before it is shown. NO auto-retry; a downgrade with a known
 * reset (midnight, retry_after_s) resumes on its own on the timer or on tab focus.
 */
export type LaneStatus =
  'off' | 'idle' | 'pending' | 'fresh' | 'cache' | 'skipped' | 'unavailable' | 'not_precomputed';

export interface LaneDoc {
  id: string;
  docHash: string;
  source: 'sample' | 'upload';
  firmId: string | null;
}

export interface LaneState {
  status: LaneStatus;
  docId: string | null;
  banner: BannerKey | null;
  /** Skip note without a banner (nothing to review, earlier stage failed). */
  note: string | null;
  /** Verified AI findings shown. */
  count: number;
  /** AI findings rejected by the verify chain (quote not found, schema, too long). */
  rejected: number;
  /** "N of M firm rules applied" when the rule caps truncated the injected set. */
  rulesNotice: string | null;
  /** ms epoch when a downgrade may resume on its own; null = manual Retry / never. */
  resetAt: number | null;
}

const EMPTY: Omit<LaneState, 'status' | 'docId'> = {
  banner: null,
  note: null,
  count: 0,
  rejected: 0,
  rulesNotice: null,
  resetAt: null,
};

export const useAiLane = create<LaneState>(() => ({ status: 'idle', docId: null, ...EMPTY }));

/** Where verified AI findings go (review store registers itself; avoids an import cycle). */
type Sink = (docId: string, findings: FindingView[]) => void;
let sink: Sink = () => undefined;
export function setAiSink(fn: Sink): void {
  sink = fn;
}

interface Ctx {
  doc: LaneDoc;
  bytes: Uint8Array;
  candidates: AiCandidate[];
  failed: boolean;
  ruleTexts: string[] | null;
  /** a fresh run was requested for this document (upload auto-run, Run / Retry): resume target */
  wanted: boolean;
}

let ctx: Ctx | null = null;
let seq = 0;
let controller: AbortController | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

const set = (p: Partial<LaneState>) => useAiLane.setState(p);

function abortCall(): void {
  controller?.abort();
  controller = null;
}

function clearTimer(): void {
  if (timer !== null) clearTimeout(timer);
  timer = null;
}

function startStatus(): LaneStatus {
  if (!useSession.getState().aiOn) return 'off';
  return apiEnabled() ? 'pending' : 'idle';
}

function timeoutSignal(ms: number): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(ms)
    : undefined;
}

/** Active firm rule texts (plain strings); null when the firm's rules cannot be read. */
async function ruleTextsFor(c: Ctx, reread = false): Promise<string[] | null> {
  if (!c.doc.firmId) return [];
  if (c.ruleTexts && !reread) return c.ruleTexts;
  try {
    const api = memoryApi();
    const r = api ? await api.firmRules(c.doc.firmId) : [];
    const texts = Array.isArray(r) ? r.filter((x): x is string => typeof x === 'string') : [];
    if (!reread) c.ruleTexts = texts;
    return texts;
  } catch {
    return null;
  }
}

async function hash8Of(texts: string[]): Promise<string | null> {
  try {
    return await rulesHash8InWorker(texts);
  } catch {
    return null;
  }
}

/** Verify in the engine worker; re-analyze once when the document graph was evicted (LRU 2). */
async function verify(
  c: Ctx,
  data: unknown,
  rules: string[],
  vctx: VerifyAiContext,
): Promise<VerifyAiResponse> {
  try {
    let v = await verifyAiInWorker(data, c.doc.docHash, rules, vctx);
    if (!v.ok && v.error === 'doc_not_retained') {
      await analyzeInWorker(c.bytes, {}, () => undefined);
      v = await verifyAiInWorker(data, c.doc.docHash, rules, vctx);
    }
    return v;
  } catch {
    return { ok: false, error: 'schema' };
  }
}

function applyVerified(v: Extract<VerifyAiResponse, { ok: true }>, status: 'fresh' | 'cache') {
  // log counts only, never document or model text
  if (v.rejected.length > 0)
    console.info('[ai] unverifiable AI findings rejected', v.rejected.length);
  set({
    status,
    ...EMPTY,
    count: v.findings.length,
    rejected: v.rejected.length,
    rulesNotice:
      v.rulesApplied < v.rulesTotal
        ? `${v.rulesApplied} of ${rulesTotalLabel(v.rulesTotal)} firm rules applied`
        : null,
  });
}

/** The Worker reads at most 101 active rules (review M3): more than 100 shows as "100+". */
export function rulesTotalLabel(total: number): string {
  return total > 100 ? '100+' : String(total);
}

function downgrade(key: BannerKey, retryAfterS?: number): void {
  clearTimer();
  const at = resumeAt(key, retryAfterS, Date.now());
  set({ status: BANNERS[key].lane, ...EMPTY, banner: key, resetAt: at });
  if (at !== null) {
    const ms = Math.min(Math.max(0, at - Date.now()), 2_147_000_000);
    timer = setTimeout(tryResume, ms + 50);
  }
}

/** Static lookup and verification; tells the caller whether a fresh /api/ai run should follow. */
async function evaluate(my: number): Promise<{ findings: FindingView[]; fresh: boolean }> {
  const none = { findings: [] as FindingView[], fresh: false };
  const c = ctx;
  if (!c) return none;
  clearTimer();
  const base = { docId: c.doc.id, ...EMPTY };
  if (!useSession.getState().aiOn) {
    set({ ...base, status: 'off' });
    return none;
  }
  if (!apiEnabled()) {
    set({ ...base, status: 'idle' });
    return none;
  }
  if (c.failed) {
    set({ ...base, status: 'skipped', note: 'an earlier stage failed' });
    return none;
  }
  if (c.candidates.length === 0) {
    set({ ...base, status: 'skipped', note: 'nothing for the AI to review' });
    return none;
  }
  set({ ...base, status: 'pending' });
  const rules = await ruleTextsFor(c);
  if (my !== seq) return none;
  if (rules === null) {
    downgrade('rules_unavailable');
    return none;
  }
  const hash8 = await hash8Of(rules);
  if (my !== seq) return none;
  const signal = timeoutSignal(5000);
  const pre = hash8
    ? await loadPrecomputed(apiBase(), c.doc.docHash, hash8, signal ? { signal } : {})
    : null;
  if (my !== seq) return none;
  if (pre) {
    const v = await verify(c, pre.result, rules, { model: pre.model, provenance: 'cache' });
    if (my !== seq) return none;
    if (v.ok) {
      applyVerified(v, 'cache');
      return { findings: v.findings, fresh: false };
    }
  }
  if (c.doc.source === 'sample') {
    set({ ...base, status: 'not_precomputed' });
    return none;
  }
  return { findings: [], fresh: true };
}

/** Document open started: drop the previous document's lane (abort any call in flight). */
export function aiBeginOpen(): void {
  abortCall();
  clearTimer();
  seq++;
  ctx = null;
  set({ status: startStatus(), docId: null, ...EMPTY });
}

/**
 * Document analyzed (before the Findings list is shown): static precomputed lookup + verify. Returns
 * the verified cached findings to merge and whether a fresh call should start once the list shows
 * (uploads only; samples wait for the explicit "Run AI on this sample").
 */
export async function aiOnOpen(
  bytes: Uint8Array,
  result: EngineResult,
  doc: LaneDoc,
): Promise<{ findings: FindingView[]; fresh: boolean }> {
  abortCall();
  const my = ++seq;
  ctx = {
    doc,
    bytes,
    candidates: result.aiCandidates ?? [],
    failed: result.failedStage !== null,
    ruleTexts: null,
    wanted: false,
  };
  return evaluate(my);
}

/** Fresh AI review through /api/ai: upload auto-run, "Run AI on this sample", Retry, resume. */
export async function aiRunFresh(): Promise<void> {
  const c = ctx;
  if (!c || !useSession.getState().aiOn || !apiEnabled()) return;
  if (c.failed || c.candidates.length === 0) return;
  abortCall();
  clearTimer();
  const my = ++seq;
  c.wanted = true;
  set({ status: 'pending', docId: c.doc.id, ...EMPTY });
  const rules = await ruleTextsFor(c);
  if (my !== seq) return;
  if (rules === null) return downgrade('rules_unavailable');
  const before = await hash8Of(rules);
  if (my !== seq) return;
  // F7: without the expected hash the L5 echo check cannot run; never call with unchecked rules
  if (rulesHashMissing(before, useSession.getState().readOnly, c.doc.firmId)) {
    return downgrade('rules_unavailable');
  }
  const ac = new AbortController();
  controller = ac;
  const t = await requestAi({
    docHash: c.doc.docHash,
    // demo / read-only path (no active rules for this request): law_firm_id null, rules hash 'none';
    // a firm is sent only when its active rules are injected (matches the lookup hash above)
    lawFirmId: rules.length > 0 ? c.doc.firmId : null,
    candidates: c.candidates,
    signal: ac.signal,
  });
  if (my !== seq) return;
  controller = null;
  if (t.kind === 'aborted') return;
  if (t.kind === 'error') return downgrade(bannerFor(t.error), t.error.retryAfterS);
  if (t.resultKind !== 'ai') return downgrade('result_unusable');
  // L5: the Worker echoes the rules it injected; on a mismatch drop the cached rule texts so the
  // next Retry re-reads the firm's rules, and never show findings computed for other rules
  // (read-only sessions never get rules injected server-side, so they skip the check)
  if (rulesEchoMismatch(t.meta, useSession.getState().readOnly ? null : before)) {
    c.ruleTexts = null;
    sink(c.doc.id, []);
    return downgrade('rules_changed');
  }
  const provenance = t.cache === 'hit' ? 'cache' : 'fresh';
  const v = await verify(c, t.data, rules, { model: t.model, provenance });
  if (my !== seq) return;
  if (!v.ok) return downgrade('result_unusable');
  // never show findings computed for rules that changed while the call was running
  const now = await ruleTextsFor(c, true);
  const after = now === null ? null : await hash8Of(now);
  if (my !== seq) return;
  if (after !== before) {
    c.ruleTexts = null;
    sink(c.doc.id, []);
    return downgrade('rules_changed');
  }
  applyVerified(v, provenance);
  sink(c.doc.id, v.findings);
  if (t.cache === 'miss') void useSession.getState().refreshQuota();
}

/**
 * Review fix F7: true when the expected rules hash could not be computed for a writable session on
 * a firm document. The L5 echo check would silently pass (`expected === null`), so the lane is
 * downgraded to `rules_unavailable` instead. Read-only sessions and no-firm documents never get
 * rules injected server-side, so they are exempt.
 */
export function rulesHashMissing(
  expected: string | null,
  readOnly: boolean,
  firmId: string | null | undefined,
): boolean {
  return expected === null && !readOnly && typeof firmId === 'string' && firmId.length > 0;
}

/**
 * L5 rules echo: true when the AI result frame carries `meta.rules_hash8` and it differs from the
 * hash of the rules this client holds (`'none'` when no rules were sent). No echo = no check.
 */
export function rulesEchoMismatch(
  meta: Record<string, unknown> | undefined,
  expected: string | null,
): boolean {
  const echo = meta?.['rules_hash8'];
  if (typeof echo !== 'string' || expected === null) return false;
  return echo !== expected;
}

/** Resume a downgraded lane once its reset time has passed (timer or tab focus). */
export function tryResume(): void {
  const s = useAiLane.getState();
  if (s.resetAt === null || Date.now() < s.resetAt) return;
  if (s.status !== 'skipped' && s.status !== 'unavailable') return;
  if (!ctx || !ctx.wanted || s.docId !== ctx.doc.id) return;
  void aiRunFresh();
}

/** AI switch changed: off drops AI findings and aborts; on re-runs the lookup for the open document. */
async function aiToggled(on: boolean): Promise<void> {
  abortCall();
  clearTimer();
  const my = ++seq;
  const c = ctx;
  if (!c) {
    set({ status: on ? 'idle' : 'off', docId: null, ...EMPTY });
    return;
  }
  if (!on) {
    sink(c.doc.id, []);
    set({ status: 'off', docId: c.doc.id, ...EMPTY });
    return;
  }
  const r = await evaluate(my);
  if (my !== seq) return;
  sink(c.doc.id, r.findings);
  if (r.fresh) void aiRunFresh();
}

/** Mount once (Findings shell): AI toggle, API base change, quota at start, resume on focus. */
export function useAiLaneEffects(): void {
  useEffect(() => {
    void useSession.getState().refreshQuota();
    const offToggle = useSession.subscribe((s, prev) => {
      if (s.aiOn !== prev.aiOn) void aiToggled(s.aiOn);
    });
    const offBase = onApiBaseChange(() => {
      void useSession.getState().refreshQuota();
      if (ctx && useAiLane.getState().status === 'idle') void aiToggled(useSession.getState().aiOn);
    });
    const onFocus = () => tryResume();
    const onVis = () => {
      if (document.visibilityState === 'visible') tryResume();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      offToggle();
      offBase();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
}
