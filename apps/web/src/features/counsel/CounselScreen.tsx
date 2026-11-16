import { PageIntro } from '../../components/ui/PageIntro';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/ui/icon';
import { useReview } from '../../state/review';
import { useSession } from '../../state/session';
import { useShell } from '../../state/shell';
import { useGatePopover } from '../gate/gate-store';
import { MetricsPanel } from '../metrics/MetricsPanel';
import { OWNER_LABEL } from '../variance/owner-groups';
import { fmtDay } from '../requests/request-model';
import { useRequests } from '../requests/request-store';
import { RequestStatusTag } from '../requests/RequestStatusTag';
import { useOwnerRequests } from '../requests/use-requests';
import { fetchAiDrafts } from './ai-draft';
import { useCounsel } from './counsel-store';
import { useCounselPoll, useShare } from './counsel-share';
import { markReadyToDigitize } from './share-flow';
import { ShareLine, useShareRules } from './ShareControls';
import '../../styles/questions-table.css';
import '../../styles/request-drawer.css';
import { PriorCard } from './PriorCard';
import {
  activeProject,
  canMarkReady,
  MARK_READY_REASON,
  useProjects,
  type Project,
} from '../../state/projects';
import {
  emitSafe,
  onGateReady,
  onMarkedReady,
  type AppNotification,
} from '../../state/notifications';
import { isCounselMode } from '../../state/share-role';
import { aiDraftRows, priorItems, questionRows } from './sheet-model';

/** Header line: always three requests; waiting = open questions of every owner + GP documents. */
export function requestsMeta(waiting: number): string {
  return `3 requests · ${waiting} item${waiting === 1 ? '' : 's'} waiting`;
}

/**
 * Requests (app.html `#counsel`; route id kept, label "Requests" 22-10-26): three rows, one per
 * owner (Counsel, GP, Fund admin) with its status, "N of M answered", documents (GP) and Needed
 * by. A row opens the shared Request drawer on that owner's tab. The gate tag, AI draft and Mark
 * ready stay in the header; the collapsed "Already answered · Awaiting counsel" section stays below.
 */
export function CounselScreen() {
  // counsel share link v2: counsel mode never routes here (the shell shows Findings only)
  return <RequestsScreen />;
}

/** Notifications v1: emit only inside an open project, never in a counsel share tab. */
function notifyProject(build: (p: Project) => AppNotification | null): void {
  if (isCounselMode()) return;
  const ps = useProjects.getState();
  if (ps.view !== 'project') return;
  const p = activeProject(ps);
  if (p) emitSafe(() => build(p));
}

/** Gate Blocked -> Ready for the open document: ignores the first read and not-started docs. */
function useGateNotifier(gateN: number, docId: string | null): void {
  const prev = useRef<{ docId: string; n: number } | null>(null);
  useEffect(() => {
    if (!docId) {
      prev.current = null;
      return;
    }
    const last = prev.current;
    prev.current = { docId, n: gateN };
    if (!last || last.docId !== docId) return;
    if (last.n > 0 && gateN === 0) notifyProject((p) => onGateReady(p, `${docId}:${Date.now()}`));
  }, [gateN, docId]);
}

function RequestsScreen() {
  const { view, doc, items, requests } = useOwnerRequests();
  const rows = view.rows;
  const phase = useReview((s) => s.phase);
  const showToast = useReview((s) => s.showToast);
  const aiOn = useSession((s) => s.aiOn);
  const readOnly = useSession((s) => s.readOnly);
  const setOpenDoc = useShell((s) => s.setOpenDoc);
  const openGate = useGatePopover((s) => s.setOpen);
  const openDrawer = useRequests((s) => s.openDrawer);
  const load = useCounsel((s) => s.load);
  const drafts = useCounsel((s) => s.drafts);
  const aiState = useCounsel((s) => s.aiState);
  const setAiState = useCounsel((s) => s.setAiState);
  const setAiDrafts = useCounsel((s) => s.setAiDrafts);
  const setUseAi = useCounsel((s) => s.setUseAi);
  const focus = useCounsel((s) => s.focus);
  const [priorOpen, setPriorOpen] = useState(false);
  const [answeringPrior, setAnsweringPrior] = useState<string | null>(null);
  const readyAt = useShare((s) => s.readyAt);
  const [readyBusy, setReadyBusy] = useState(false);
  // Projects v1: advisory View-as gate (UI-only); only the Approver may mark ready
  const roleAllowsReady = useProjects((s) => canMarkReady(s.viewAs));
  const { canShare } = useShareRules();
  useCounselPoll(canShare);

  useEffect(() => {
    void load(doc?.id ?? null);
  }, [doc?.id, load]);

  const qs = useMemo(() => questionRows(rows), [rows]);
  const prior = useMemo(() => priorItems(rows), [rows]);
  const gateN = view.gate.reasons.length;
  useGateNotifier(gateN, phase === 'ready' ? (doc?.id ?? null) : null);
  const waiting = requests.reduce((n, r) => n + r.waiting, 0);
  const defaultBy = doc?.firmName ? `Counsel, ${doc.firmName}` : 'Counsel';

  // gate popover links to a prior item (not in any request): open the prior list
  useEffect(() => {
    if (!focus) return;
    const id = focus.id;
    if ([...prior.answered, ...prior.awaiting].some((r) => r.f.id === id)) {
      setPriorOpen(true);
      requestAnimationFrame(() =>
        document.getElementById(`cs-x-${id}`)?.scrollIntoView({ block: 'center' }),
      );
    }
    // focus.seq re-triggers on the same id
  }, [focus]);

  const toggleAi = async () => {
    if (drafts.useAi) {
      setUseAi(false);
      showToast('Showing the template draft.');
      return;
    }
    // change questions never get an AI draft (deterministic template only, 0 live AI calls)
    const missing = aiDraftRows(qs).filter((r) => !drafts.ai[r.f.id]);
    if (!missing.length) {
      setUseAi(true);
      return;
    }
    if (!doc) return;
    setAiState('running');
    const res = await fetchAiDrafts(
      missing.map((r) => ({
        id: r.f.id,
        quote: r.f.quote,
        section_path: r.f.section_path,
        issue_class: r.f.issue_class,
      })),
      doc.id,
      aiOn,
    );
    if (res.ok) {
      setAiDrafts(res.drafts, res.model);
      setUseAi(true);
      setAiState('idle');
      showToast('AI draft ready. Check the wording before you send it.');
    } else {
      setAiState(res.reason === 'off' ? 'idle' : 'unavailable');
      showToast('The AI draft is not available right now. The template draft is used.');
    }
  };

  return (
    <section className="view" aria-labelledby="h-counsel" data-testid="counsel-view">
      <header className="pagehead">
        <div className="tt qt-tt">
          <h1 id="h-counsel" tabIndex={-1}>
            Requests
          </h1>
          <p className="meta" data-testid="counsel-meta">
            {doc ? requestsMeta(waiting) : 'No document open'}
          </p>
          {doc ? (
            <span role="status" data-testid="counsel-gate-line" data-blocked={gateN > 0}>
              <button
                type="button"
                className={gateN ? 'tag t-re qt-gate' : 'tag t-ok qt-gate'}
                aria-haspopup="dialog"
                data-testid="counsel-gate-reasons"
                title="Accepting a finding does not open the gate. Only a counsel answer does."
                onClick={() => requestAnimationFrame(() => openGate(true))}
              >
                <Icon name={gateN ? 'lock' : 'unlock'} />
                {gateN ? `Blocked · ${gateN}` : 'Ready'}
                <span className="sr">
                  {gateN
                    ? `: digitization is blocked, ${gateN} critical item${gateN > 1 ? 's' : ''} open. See reasons. Accepting a finding does not open the gate. Only a counsel answer does.`
                    : ': every critical item is resolved. See reasons.'}
                </span>
              </button>
            </span>
          ) : null}
          {readyAt ? (
            <span className="tag t-ok" data-testid="counsel-ready-pill">
              <Icon name="check" />
              Ready to digitize
            </span>
          ) : null}
        </div>
        {doc ? (
          <div className="hacts">
            <button
              type="button"
              className="btn sm"
              data-testid="counsel-ai-draft"
              aria-pressed={drafts.useAi}
              disabled={!aiOn || aiState === 'running' || !aiDraftRows(qs).length}
              title={aiOn ? undefined : 'AI review is off'}
              onClick={() => void toggleAi()}
            >
              <Icon name="spark" />
              {aiState === 'running' ? 'Drafting…' : 'AI draft'}
            </button>
            <button
              type="button"
              className="btn sm"
              data-testid="counsel-mark-ready"
              disabled={gateN > 0 || phase !== 'ready' || readyBusy || !roleAllowsReady}
              title={
                !roleAllowsReady
                  ? MARK_READY_REASON
                  : gateN > 0
                    ? 'Every critical item needs a counsel answer first'
                    : undefined
              }
              aria-describedby={roleAllowsReady ? undefined : 'counsel-ready-role-reason'}
              onClick={async () => {
                if (!doc || gateN > 0 || !roleAllowsReady) return;
                setReadyBusy(true);
                try {
                  const out = await markReadyToDigitize({ doc, items, drafts });
                  notifyProject((p) => onMarkedReady(p, doc.id));
                  showToast(
                    `Ready to digitize. Final answers downloaded.${out.note ? ` ${out.note}` : ''}`,
                  );
                } catch {
                  showToast('The final DOCX could not be built. Try again.');
                } finally {
                  setReadyBusy(false);
                }
              }}
            >
              <Icon name="unlock" />
              Mark ready to digitize
            </button>
            {roleAllowsReady ? null : (
              <span
                className="pj-ready-reason"
                id="counsel-ready-role-reason"
                data-testid="counsel-ready-role-reason"
              >
                {MARK_READY_REASON}
              </span>
            )}
          </div>
        ) : null}
      </header>
      <PageIntro testId="page-intro-questions">
        One request each for counsel, the GP and the fund admin. Open a request to see its questions
        and documents, send it, and track the answers here.
      </PageIntro>
      {doc && !doc.firmId ? (
        <p className="cs-note" data-testid="counsel-no-firm">
          <Icon name="info" />
          Memory needs a law firm tag: answers stay in this browser and are not remembered for the
          next fund. Export still works.
        </p>
      ) : null}
      {doc && doc.firmId && readOnly ? (
        <p className="cs-note" data-testid="counsel-read-only">
          <Icon name="info" />
          This demo workspace is read-only: answers and exports are not written to memory.
        </p>
      ) : null}
      <ShareLine />
      <div className="pgbody">
        {!doc || phase !== 'ready' ? (
          <div className="empty2" data-testid="counsel-empty">
            <p className="ph-t">
              {phase === 'loading' ? 'Reading the document…' : 'No document is open.'}
            </p>
            {phase !== 'loading' ? (
              <button className="btn" type="button" onClick={() => setOpenDoc(true)}>
                <Icon name="doc" />
                Open a document
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <ul className="rq-list" data-testid="requests-list" aria-label="Requests">
              {requests.map((r) => {
                const none = r.status === 'none';
                const body = (
                  <>
                    <span className="who">{OWNER_LABEL[r.owner]}</span>
                    <RequestStatusTag
                      status={r.status}
                      overdue={r.overdue}
                      sentAt={r.sentAt}
                      round={r.round}
                    />
                    <span className="mut" data-testid="requests-row-answered">
                      {none ? '' : `${r.counts.answered} of ${r.counts.total} answered`}
                    </span>
                    <span className="mut" data-testid="requests-row-docs">
                      {r.owner === 'gp' && r.counts.documents
                        ? `${r.counts.documents} document${r.counts.documents === 1 ? '' : 's'}`
                        : ''}
                    </span>
                    <span className="mut">{none ? '' : `Needed by ${fmtDay(r.neededBy)}`}</span>
                  </>
                );
                return (
                  <li key={r.owner}>
                    {none ? (
                      <div
                        className="rq-row"
                        aria-disabled="true"
                        data-testid={`requests-row-${r.owner}`}
                        data-status="none"
                      >
                        {body}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="rq-row"
                        data-testid={`requests-row-${r.owner}`}
                        data-status={r.status}
                        onClick={() => openDrawer(r.owner)}
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <section className="prevwrap" aria-label="Not on this sheet">
              <button
                className="prevbtn"
                type="button"
                data-testid="counsel-prior-toggle"
                aria-expanded={priorOpen}
                aria-controls="cs-exlist"
                onClick={() => setPriorOpen(!priorOpen)}
              >
                <Icon name="chev" />
                <span>
                  Already answered ({prior.answered.length}) · Awaiting counsel (
                  {prior.awaiting.length})
                </span>
                <span className="help">From earlier reviews, not in these requests</span>
              </button>
              <div
                className="prevlist"
                id="cs-exlist"
                data-testid="counsel-prior-list"
                hidden={!priorOpen}
              >
                {prior.answered.length + prior.awaiting.length ? (
                  [...prior.answered, ...prior.awaiting].map((r) => (
                    <PriorCard
                      key={r.f.id}
                      r={r}
                      answering={answeringPrior === r.f.id}
                      defaultBy={defaultBy}
                      onAnswer={(on) => setAnsweringPrior(on ? r.f.id : null)}
                    />
                  ))
                ) : (
                  <div className="empty">Nothing here.</div>
                )}
              </div>
            </section>
            <MetricsPanel docId={doc.id} refresh={0} />
          </>
        )}
      </div>
    </section>
  );
}
