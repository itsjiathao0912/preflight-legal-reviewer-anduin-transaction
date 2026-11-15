import { maskQuote, parseQuestionKey, type Owner } from '@aduin/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/ui/icon';
import { downloadBlob } from '../../lib/download';
import { useReview } from '../../state/review';
import { useCounsel } from '../counsel/counsel-store';
import { questionIdsByKey, useShare } from '../counsel/counsel-share';
import { DOCX_MIME } from '../counsel/exportDocx';
import { exportCounselSheet } from '../counsel/export-flow';
import { useGpRequests } from '../counsel/GpRequestGroup';
import { buildRequestDocx, requestDocxFilename } from '../counsel/exportRequestDocx';
import { QuestionRow, type RowMode } from '../counsel/QuestionRow';
import { ShareButton } from '../counsel/ShareControls';
import { buildSheet, wordingFor } from '../counsel/sheet-model';
import { usePackageView } from '../package/package-view';
import { itemNeedsAnswer, OWNER_LABEL, OWNER_ORDER } from '../variance/owner-groups';
import { useVariance } from '../variance/variance-store';
import { aboutLine, requestText, shortDay } from './request-model';
import { useRequests } from './request-store';
import { RequestStatusTag } from './RequestStatusTag';
import { useOwnerRequests } from './use-requests';
import '../../styles/questions-table.css';
import '../../styles/request-drawer.css';

const TITLE: Record<Owner, string> = {
  counsel: 'Request to counsel',
  gp: 'Request to the GP',
  fund_admin: 'Request to the fund admin',
};

/**
 * Request drawer (22-10-26): ONE side drawer over the current screen (no route change) with a tab
 * per owner. Header fields (To, About, Needed by), the owner's questions (the Questions row: quote,
 * A/B/C readings, Record answer), the GP's documents to send grouped by kind, and the footer
 * actions. Escape and × close; the title takes focus on open and focus returns to the opener.
 */
export function RequestDrawer() {
  const open = useRequests((s) => s.open);
  if (!open) return null;
  return <Drawer owner={open} />;
}

function Drawer({ owner }: { owner: Owner }) {
  const { view, doc, groups, requests } = useOwnerRequests();
  const rows = view.rows;
  const req = requests.find((r) => r.owner === owner)!;
  const openDrawer = useRequests((s) => s.openDrawer);
  const close = useRequests((s) => s.close);
  const setMeta = useRequests((s) => s.setMeta);
  const markSentRaw = useRequests((s) => s.markSent);
  const addExtra = useRequests((s) => s.addExtra);
  const removeExtra = useRequests((s) => s.removeExtra);
  const focus = useRequests((s) => s.focus);
  const memory = useReview((s) => s.memory);
  const showToast = useReview((s) => s.showToast);
  const drafts = useCounsel((s) => s.drafts);
  const loadDrafts = useCounsel((s) => s.load);
  const shareSheet = useShare((s) => s.sheet);
  const qidByKey = useMemo(() => questionIdsByKey(shareSheet), [shareSheet]);
  const gp = useGpRequests();
  const pkg = usePackageView();
  const baselineName = useVariance((s) =>
    s.docId === doc?.id ? (s.baseline?.name ?? null) : null,
  );
  const vMeta = useVariance((s) => (s.docId === doc?.id ? s.result?.meta : undefined));
  const [sel, setSel] = useState<string | null>(null);
  const [mode, setMode] = useState<RowMode>('view');
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    void loadDrafts(doc?.id ?? null);
  }, [doc?.id, loadDrafts]);

  // focus the title on open; give focus back to the opener on close
  useEffect(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    titleRef.current?.focus();
    const back = opener.current;
    return () => {
      if (back && document.contains(back)) back.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // an open Radix dialog or popover closes first
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  // a new tab starts collapsed; a focus request opens that question
  useEffect(() => {
    setSel(null);
    setMode('view');
  }, [owner]);
  useEffect(() => {
    if (!focus) return;
    if (!req.questions.some((q) => q.key === focus.key)) return;
    setSel(focus.key);
    setMode('view');
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(
          `[data-testid="request-drawer"] [data-testid="counsel-row"][data-key="${CSS.escape(focus.key)}"] .rowb`,
        )
        ?.scrollIntoView({ block: 'nearest' }),
    );
  }, [focus]);

  const rowsById = useMemo(() => new Map(rows.map((r) => [r.f.id, r])), [rows]);
  const wording = (key: string) => {
    const r = rowsById.get(parseQuestionKey(key).findingId);
    return r ? wordingFor(r, drafts, key).text : '';
  };
  const openQs = req.questions.filter(itemNeedsAnswer);
  const docs = owner === 'gp' ? groups : [];
  const markSent = (o: Owner) =>
    markSentRaw(
      o,
      req.questions.length,
      req.questions.filter(itemNeedsAnswer).map((q) => q.key),
    );
  const nQs = req.questions.length + req.extra.length;
  const nextDraft = req.round > 0 && nQs > req.sentCount;
  const nDocs = docs.reduce((n, g) => n + g.docs.length, 0);
  const about = aboutLine(doc);
  const defaultBy = doc?.firmName ? `Counsel, ${doc.firmName}` : 'Counsel';

  const copy = async () => {
    const text = requestText({
      owner,
      to: req.to,
      about,
      neededBy: req.neededBy,
      questions: req.questions.map((q) => ({
        text: wording(q.key),
        quote: maskQuote(q.row.f.quote),
        loc: q.row.f.loc,
        answer: itemNeedsAnswer(q) ? null : q.answer,
      })),
      groups: docs,
      extra: req.extra,
    });
    try {
      await navigator.clipboard.writeText(text);
      showToast('Request copied.');
    } catch {
      showToast('The text could not be copied. Use Export DOCX instead.');
    }
  };

  const exportDocx = async () => {
    if (!doc) return;
    setBusy(true);
    try {
      let files = 0;
      if (openQs.length) {
        const meta = {
          title: `Questions for ${OWNER_LABEL[owner]} · ${doc.fund || doc.name || 'Document'}`,
          firm: doc.firmId ? doc.firmName || null : null,
          fund: doc.fund || null,
          version: doc.version || null,
        };
        await exportCounselSheet({
          doc,
          sheet: buildSheet(meta, rows, owner),
          rows,
          findings: rows.map((r) => r.f),
          memory,
          wording,
        });
        files++;
      }
      if (owner === 'gp' && gp?.length) {
        const meta = {
          firm: pkg?.firmId ? pkg.firmName : null,
          fund: pkg?.fund ?? doc.fund ?? null,
          version: pkg?.version ?? doc.version ?? null,
        };
        downloadBlob(requestDocxFilename(meta), await buildRequestDocx(meta, gp), DOCX_MIME);
        files++;
      }
      if (owner === 'counsel') markSent('counsel');
      showToast(`Request exported${files > 1 ? ` (${files} files)` : ''}.`);
    } catch {
      showToast('The request could not be exported. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const nothing = !openQs.length && !nDocs && !req.extra.length;

  return (
    <aside
      className="rq-drawer"
      role="dialog"
      aria-labelledby="rq-title"
      data-testid="request-drawer"
      data-owner={owner}
    >
      <header className="rq-head">
        <h2 id="rq-title" ref={titleRef} tabIndex={-1}>
          {TITLE[owner]}
        </h2>
        <button type="button" className="od-x" aria-label="Close" onClick={close}>
          <Icon name="x" />
        </button>
      </header>
      <div className="rq-tabs" role="tablist" aria-label="Who the request is for">
        {OWNER_ORDER.map((o) => {
          const r = requests.find((x) => x.owner === o)!;
          return (
            <button
              key={o}
              type="button"
              role="tab"
              aria-selected={o === owner}
              data-testid={`request-tab-${o}`}
              data-count={r.waiting}
              onClick={() => openDrawer(o)}
            >
              {OWNER_LABEL[o]}
              <span className="n">{r.waiting}</span>
            </button>
          );
        })}
      </div>
      <div className="rq-body" role="tabpanel" aria-labelledby="rq-title">
        <div className="rq-status">
          {nextDraft ? (
            <>
              <span className="tag t-st" data-testid="request-status" data-status="draft">
                Round {req.round + 1} · draft
              </span>
              <span className="mut" data-testid="request-last-round">
                Round {req.round} sent {req.sentAt ? shortDay(req.sentAt) : ''} ·{' '}
                {req.counts.answered} of {req.counts.total} answered
              </span>
            </>
          ) : (
            <RequestStatusTag
              status={req.status}
              overdue={req.overdue}
              sentAt={req.sentAt}
              round={req.round}
              testId="request-status"
            />
          )}
          {req.counts.total && !nextDraft ? (
            <span className="mut">
              {req.counts.answered} of {req.counts.total} answered
            </span>
          ) : null}
        </div>
        <dl className="rq-meta">
          <dt>
            <label htmlFor="rq-to">To</label>
          </dt>
          <dd>
            <input
              id="rq-to"
              type="text"
              maxLength={200}
              data-testid="request-to"
              value={req.to}
              onChange={(e) => setMeta(owner, { to: e.target.value })}
            />
          </dd>
          <dt>About</dt>
          <dd data-testid="request-about">{about}</dd>
          <dt>
            <label htmlFor="rq-by">Needed by</label>
          </dt>
          <dd>
            <input
              id="rq-by"
              type="date"
              data-testid="request-needed-by"
              value={req.neededBy}
              onChange={(e) => {
                if (e.target.value) setMeta(owner, { neededBy: e.target.value });
              }}
            />
          </dd>
        </dl>
        <section aria-labelledby="rq-qh">
          <h3 id="rq-qh" className="rq-h">
            Questions <span className="n">{nQs}</span>
          </h3>
          {req.questions.length || req.extra.length ? (
            <ul className="rows qt-rows rq-qs" data-testid="request-questions">
              {req.questions.map((q, i) => (
                <QuestionRow
                  key={q.key}
                  q={q}
                  n={i + 1}
                  selected={sel === q.key}
                  mode={sel === q.key ? mode : 'view'}
                  defaultBy={defaultBy}
                  candidate={q.change ? vMeta?.[q.findingId]?.assertion_candidate : undefined}
                  questionId={qidByKey[q.key]}
                  baseline={baselineName}
                  onToggle={() => {
                    setSel(sel === q.key ? null : q.key);
                    setMode('view');
                  }}
                  onMode={setMode}
                  asked={req.asked[q.key]}
                />
              ))}
              {req.extra.map((x, i) => (
                <li key={x.id} className="rq-extra" data-testid="request-extra">
                  <span className="mut">{req.questions.length + i + 1}.</span>
                  <div>
                    {x.where ? <small className="mut">{x.where} · </small> : null}
                    <span>{x.question}</span> <span className="tag t-st">Added by you</span>
                    {x.quote ? <q>{x.quote}</q> : null}
                  </div>
                  <button
                    type="button"
                    className="btn"
                    aria-label="Remove question"
                    onClick={() => removeExtra(owner, x.id)}
                  >
                    <Icon name="x" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mut" data-testid="request-no-questions">
              {owner === 'counsel'
                ? 'No questions yet. Use Ask counsel on a finding.'
                : `No questions yet. Use Ask owner on a change for the ${OWNER_LABEL[owner]}.`}
            </p>
          )}
          <AddQuestion
            round={req.round + 1}
            onAdd={(q) => {
              addExtra(owner, q);
              showToast('Question added.');
            }}
          />
        </section>
        {owner === 'gp' ? (
          <section aria-labelledby="rq-dh" data-testid="request-documents">
            <h3 id="rq-dh" className="rq-h">
              Documents to send <span className="n">{nDocs}</span>
            </h3>
            {nDocs ? (
              <>
                <p className="mut">
                  The subscription agreement refers to these documents, but they are not in the
                  package.
                </p>
                {docs.map((g) => (
                  <div key={g.family} className="rq-grp" data-testid="request-doc-group">
                    <h4>
                      {g.label} ({g.docs.length})
                    </h4>
                    <ul>
                      {g.docs.map((d) => (
                        <li
                          key={d.key}
                          className="rq-doc"
                          data-testid="request-doc"
                          data-target-key={d.key}
                        >
                          <b>{d.label}</b>
                          {d.quote ? <q data-testid="request-doc-quote">{d.quote}</q> : null}
                          {d.location ? (
                            <small className="mut" data-testid="request-doc-loc">
                              {d.location}
                            </small>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </>
            ) : (
              <p className="mut">Every referenced document is in the package.</p>
            )}
          </section>
        ) : null}
      </div>
      <footer className="rq-foot">
        {owner === 'counsel' ? (
          <ShareButton rows={rows} onShared={() => markSent('counsel')} />
        ) : null}
        <button
          type="button"
          className="btn"
          data-testid="request-copy"
          disabled={nothing}
          onClick={() => void copy()}
        >
          Copy text
        </button>
        <button
          type="button"
          className="btn"
          data-testid="request-export"
          disabled={nothing || busy}
          onClick={() => void exportDocx()}
        >
          <Icon name="doc" />
          Export DOCX
        </button>
        {owner !== 'counsel' ? (
          <button
            type="button"
            className="btn pri"
            data-testid="request-mark-sent"
            disabled={nothing || (req.round > 0 && !nextDraft)}
            onClick={() => {
              markSent(owner);
              showToast(
                `Request to ${owner === 'gp' ? 'the GP' : 'the fund admin'} marked as sent.`,
              );
            }}
          >
            <Icon name="check" />
            {req.round === 0
              ? 'Mark as sent'
              : nextDraft
                ? `Send round ${req.round + 1}`
                : `Round ${req.round} sent`}
          </button>
        ) : null}
      </footer>
    </aside>
  );
}

/** "+ Add question": a small inline form for a question the checks did not raise. */
function AddQuestion({
  round,
  onAdd,
}: {
  round: number;
  onAdd: (q: { where: string; quote: string; question: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [where, setWhere] = useState('');
  const [quote, setQuote] = useState('');
  const [question, setQuestion] = useState('');
  const reset = () => {
    setWhere('');
    setQuote('');
    setQuestion('');
    setOpen(false);
  };
  if (!open)
    return (
      <button
        type="button"
        className="btn rq-add"
        data-testid="request-add-question"
        onClick={() => setOpen(true)}
      >
        + Add question
      </button>
    );
  return (
    <form
      className="rq-addf"
      data-testid="request-add-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!question.trim()) return;
        onAdd({ where, quote, question });
        reset();
      }}
    >
      <input
        type="text"
        maxLength={200}
        aria-label="Where"
        placeholder="Where · e.g. Section 12"
        value={where}
        onChange={(e) => setWhere(e.target.value)}
      />
      <textarea
        maxLength={2000}
        aria-label="Quote"
        placeholder="Paste the sentence from the document"
        value={quote}
        onChange={(e) => setQuote(e.target.value)}
      />
      <textarea
        maxLength={2000}
        aria-label="Question"
        placeholder="Your question · options A / B (optional)"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />
      <div className="rq-addb">
        <button type="submit" className="btn pri" disabled={!question.trim()}>
          Add to round {round}
        </button>
        <button type="button" className="btn" onClick={reset}>
          Cancel
        </button>
      </div>
    </form>
  );
}
