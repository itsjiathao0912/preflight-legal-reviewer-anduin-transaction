import {
  DOC_REF_RE,
  parseQuestionKey,
  type CounselComment,
  type CounselSheetResponse,
  type Owner,
} from '@aduin/core';
import { useEffect } from 'react';
import { create } from 'zustand';
import { getSheet } from '../../api/counselShareApi';
import { docRefOf } from '../open-document/demo-refs';
import { useReview, type RemoteAnswer } from '../../state/review';
import { useSession } from '../../state/session';
import { isCounselMode, setCounselMode } from '../../state/share-role';

/**
 * Counsel share link state (counsel-share-link plan, 19-10-26).
 * - `role`: `analyst` (default) or `counsel` once a share link was joined in this tab. Counsel mode
 *   opens the shared bundled document (`docRef`) on the normal Findings screen and overlays the
 *   shared state from the polled sheet (v2, 19-10-26).
 * - `pendingToken`: the `#counsel=<token>` fragment captured at boot (the URL is cleaned at once).
 * - `sheet`: the last GET /api/counsel/sheet (both roles); `readyAt` from it or from Mark ready.
 * - `link`: the analyst's last share link (copy target + expiry).
 */
export type ShareRole = 'analyst' | 'counsel';

export interface ShareState {
  role: ShareRole;
  counselName: string | null;
  /** Counsel: the bundled document the share names (`package:<id>` / `sample:<NN>`). */
  docRef: string | null;
  /** Counsel cookie expiry (counsel) or the share link expiry (analyst), epoch ms. */
  expiresAt: number | null;
  pendingToken: string | null;
  sheet: CounselSheetResponse | null;
  readyAt: number | null;
  link: { url: string; expiresAt: number } | null;
  setPendingToken: (t: string | null) => void;
  joined: (name: string, expiresAt: number, docRef: string) => void;
  setSheet: (s: CounselSheetResponse) => void;
  addComment: (c: CounselComment) => void;
  setReadyAt: (at: number) => void;
  setLink: (l: { url: string; expiresAt: number }) => void;
}

export const useShare = create<ShareState>((set, get) => ({
  role: 'analyst',
  counselName: null,
  docRef: null,
  expiresAt: null,
  pendingToken: null,
  sheet: null,
  readyAt: null,
  link: null,
  setPendingToken: (pendingToken) => set({ pendingToken }),
  joined: (counselName, expiresAt, docRef) => {
    enterCounselMode();
    saveCounselSession({ name: counselName, expiresAt, docRef });
    set({ role: 'counsel', counselName, expiresAt, docRef, pendingToken: null });
  },
  setSheet: (sheet) => set({ sheet, readyAt: sheet.ready_at ?? get().readyAt }),
  addComment: (c) => {
    const s = get().sheet;
    if (!s || s.comments.some((x) => x.id === c.id)) return;
    set({ sheet: { ...s, comments: [...s.comments, c] } });
  },
  setReadyAt: (readyAt) => set({ readyAt }),
  setLink: (link) => set({ link, expiresAt: link.expiresAt }),
}));

/**
 * Counsel mode switch: the memory client, outbox and session bootstrap go silent (role flag), and
 * the AI lane is turned off for this tab only (deterministic findings keep ids equal on both sides).
 */
function enterCounselMode(): void {
  setCounselMode(true);
  useSession.setState({ aiOn: false });
}

/** This tab's joined counsel session (sessionStorage: a reload keeps counsel mode, a new tab not). */
const SESSION_KEY = 'aduin:counselSession';
interface CounselSession {
  name: string;
  expiresAt: number;
  docRef: string;
}

function saveCounselSession(c: CounselSession): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(c));
  } catch {
    /* counsel mode lasts until reload */
  }
}

/**
 * Boot step: re-enter counsel mode after a reload of a joined tab (the counsel cookie is still
 * set). Returns the doc ref to re-open, or null. An expired or malformed record is dropped.
 */
export function resumeCounselSession(now: number = Date.now()): string | null {
  let c: Partial<CounselSession> | null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    c = raw ? (JSON.parse(raw) as Partial<CounselSession>) : null;
  } catch {
    c = null;
  }
  if (
    !c ||
    typeof c.name !== 'string' ||
    typeof c.expiresAt !== 'number' ||
    c.expiresAt <= now ||
    typeof c.docRef !== 'string' ||
    !DOC_REF_RE.test(c.docRef)
  ) {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
  enterCounselMode();
  useShare.setState({
    role: 'counsel',
    counselName: c.name,
    expiresAt: c.expiresAt,
    docRef: c.docRef,
  });
  return c.docRef;
}

const FRAGMENT_RE = /^#counsel=([A-Za-z0-9_.-]{1,1024})$/;

/**
 * Boot step (before the shell rewrites the hash): take a `#counsel=<token>` fragment into memory and
 * remove it from the address bar right away, so the bearer token is not left in history or shown
 * on screen. Returns true when a token was captured.
 */
export function captureCounselToken(
  loc: Pick<Location, 'hash' | 'pathname' | 'search'> = location,
  hist: Pick<History, 'replaceState'> = history,
): boolean {
  const m = FRAGMENT_RE.exec(loc.hash);
  if (!m) return false;
  useShare.getState().setPendingToken(m[1]!);
  try {
    hist.replaceState(null, '', `${loc.pathname}${loc.search}#counsel`);
  } catch {
    /* ignore */
  }
  return true;
}

/** Comments of one question, oldest first. */
export function commentsFor(sheet: CounselSheetResponse | null, questionId: string) {
  return (sheet?.comments ?? [])
    .filter((c) => c.question_id === questionId)
    .sort((a, b) => a.created_at - b.created_at);
}

/** finding key (`<findingId>` or `<findingId>@<owner>`) -> server question id. */
export function questionIdsByKey(sheet: CounselSheetResponse | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of sheet?.questions ?? []) out[q.finding_key] = q.id;
  return out;
}

/** Map active server answers onto this document's findings (owner answers by question key). */
export function remoteAnswers(sheet: CounselSheetResponse): RemoteAnswer[] {
  const byId = new Map(sheet.questions.map((q) => [q.id, q]));
  const out: RemoteAnswer[] = [];
  for (const a of sheet.answers) {
    const q = byId.get(a.question_id);
    if (!q) continue;
    const { findingId, owner } = parseQuestionKey(q.finding_key);
    out.push({
      findingId,
      ...(owner ? { owner: owner as Owner } : {}),
      option: a.option,
      ...(a.note ? { note: a.note } : {}),
      by: a.answered_by_name,
      at: a.answered_at,
    });
  }
  return out;
}

/**
 * Apply one sheet to the open document. Counsel: the triage is rebuilt in memory from the shared
 * questions and decisions, then the answers are merged (nothing is written). Analyst: counsel's
 * answers are merged into the local triage (the analyst's own states are already local). Both
 * sides then compute the gate with the same code.
 */
export async function applySheet(sheet: CounselSheetResponse): Promise<void> {
  const review = useReview.getState();
  if (!review.doc || review.phase !== 'ready') return;
  if (isCounselMode()) review.mergeRemoteStates(sheet.questions, sheet.decisions);
  await useReview.getState().mergeRemoteAnswers(remoteAnswers(sheet));
}

/**
 * One sheet read, applied to the open document. Errors are swallowed (the next tick retries);
 * returns the sheet or null.
 */
export async function refreshSheet(): Promise<CounselSheetResponse | null> {
  let sheet: CounselSheetResponse;
  // the analyst names the open bundled document; without a demo ref there is nothing to read
  const counsel = useShare.getState().role === 'counsel';
  const ref = counsel ? undefined : docRefOf(useReview.getState().doc);
  if (!counsel && !ref) return null;
  try {
    sheet = await getSheet(ref ?? undefined);
  } catch {
    return null;
  }
  useShare.getState().setSheet(sheet);
  try {
    await applySheet(sheet);
  } catch {
    /* local triage unchanged */
  }
  return sheet;
}

/** Default poll interval (AC4: changes visible within about 20 s). */
export const COUNSEL_POLL_MS = 20_000;

/**
 * Poll the sheet while `enabled` and the tab is visible: once at start, every `intervalMs`, and
 * again whenever the tab becomes visible. A hidden tab makes no request.
 */
export function useCounselPoll(enabled: boolean, intervalMs: number = COUNSEL_POLL_MS): void {
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    const tick = () => {
      if (!stopped && document.visibilityState === 'visible') void refreshSheet();
    };
    tick();
    const timer = setInterval(tick, Math.max(1_000, intervalMs));
    const onVis = () => tick();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [enabled, intervalMs]);
}

/**
 * Shell hook: counsel mode polls the sheet for the whole session, and the last sheet is applied
 * again whenever the open document (re)renders, so the overlay never waits for the next tick.
 */
export function useCounselEffects(): void {
  const counsel = useShare((s) => s.role === 'counsel');
  useCounselPoll(counsel);
  const docId = useReview((s) => (s.phase === 'ready' ? (s.doc?.id ?? null) : null));
  const resultSeq = useReview((s) => s.result);
  useEffect(() => {
    const sheet = useShare.getState().sheet;
    if (!docId || !sheet) return;
    void applySheet(sheet).catch(() => undefined);
  }, [docId, resultSeq]);
}
