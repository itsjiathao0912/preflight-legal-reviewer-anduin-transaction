import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/ui/icon';
import { useReview } from '../../state/review';
import { useSession } from '../../state/session';
import { useShell } from '../../state/shell';
import { useGatePopover } from '../gate/gate-store';
import { MetricsPanel } from '../metrics/MetricsPanel';
import { useReviewView } from '../review/use-review-view';
import { fetchAiDrafts } from './ai-draft';
import { useCounsel } from './counsel-store';
import { ExportDialog } from './ExportDialog';
import { exportCounselSheet } from './export-flow';
import { PriorCard } from './PriorCard';
import { QuestionRow, type RowMode } from './QuestionRow';
import { buildSheet, needsAnswer, priorItems, questionRows, wordingFor } from './sheet-model';

/**
 * Counsel questions (app.html `#counsel`, Phase 08): compact gate line, one row per question
 * (expand for quote, A/B/C readings, provenance, inline wording edit and Record answer), the
 * collapsed "Already answered (n) · Awaiting counsel (n)" section, and Export DOCX with a preview
 * of the unanswered New/Accepted questions only (D-1).
 */
export function CounselScreen() {
  const view = useReviewView();
  const rows = view.rows;
  const doc = useReview((s) => s.doc);
  const phase = useReview((s) => s.phase);
  const result = useReview((s) => s.result);
  const memory = useReview((s) => s.memory);
  const showToast = useReview((s) => s.showToast);
  const aiOn = useSession((s) => s.aiOn);
  const readOnly = useSession((s) => s.readOnly);
  const setOpenDoc = useShell((s) => s.setOpenDoc);
  const openGate = useGatePopover((s) => s.setOpen);
  const load = useCounsel((s) => s.load);
  const drafts = useCounsel((s) => s.drafts);
  const aiState = useCounsel((s) => s.aiState);
  const setAiState = useCounsel((s) => s.setAiState);
  const setAiDrafts = useCounsel((s) => s.setAiDrafts);
  const setUseAi = useCounsel((s) => s.setUseAi);
  const focus = useCounsel((s) => s.focus);

  const [filter, setFilter] = useState<'all' | 'open'>('all');
  const [sel, setSel] = useState<string | null>(null);
  const [mode, setMode] = useState<RowMode>('view');
  const [priorOpen, setPriorOpen] = useState(false);
  const [answeringPrior, setAnsweringPrior] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [metricsSeq, setMetricsSeq] = useState(0);

  useEffect(() => {
    void load(doc?.id ?? null);
  }, [doc?.id, load]);

  const qs = useMemo(() => questionRows(rows), [rows]);
  const prior = useMemo(() => priorItems(rows), [rows]);
  const open = qs.filter(needsAnswer);
  const shown = qs
    .map((r, i) => [r, i + 1] as const)
    .filter(([r]) => filter === 'all' || needsAnswer(r));
  const gateN = view.gate.reasons.length;
  const defaultBy = doc?.firmName ? `Counsel, ${doc.firmName}` : 'Counsel';

  // gate popover links: open the question (or the prior item) and bring it into view
  useEffect(() => {
    if (!focus) return;
    const id = focus.id;
    if (qs.some((r) => r.f.id === id)) {
      setFilter('all');
      setSel(id);
      setMode('view');
      requestAnimationFrame(() => {
        const b = document.querySelector<HTMLElement>(
          `[data-testid="counsel-row"][data-finding-id="${CSS.escape(id)}"] .rowb`,
        );
        b?.scrollIntoView({ block: 'nearest' });
        b?.focus({ preventScroll: true });
      });
    } else if ([...prior.answered, ...prior.awaiting].some((r) => r.f.id === id)) {
      setPriorOpen(true);
      requestAnimationFrame(() =>
        document.getElementById(`cs-x-${id}`)?.scrollIntoView({ block: 'center' }),
      );
    }
    // focus.seq re-triggers on the same id
  }, [focus]);

  const meta = useMemo(
    () => ({
      title: `Counsel query sheet · ${doc?.fund || doc?.name || 'Document'}`,
      firm: doc?.firmId ? doc.firmName || null : null,
      fund: doc?.fund || null,
      version: doc?.version || null,
    }),
    [doc],
  );
  const sheet = useMemo(() => buildSheet(meta, rows), [meta, rows]);
  const rowsById = useMemo(() => new Map(rows.map((r) => [r.f.id, r])), [rows]);
  const wording = (id: string) => {
    const r = rowsById.get(id);
    return r ? wordingFor(r, drafts).text : '';
  };
  const onSheet = new Set(sheet.questions.map((q) => q.findingKey));
  const leftOut = [
    ...qs
      .filter((r) => !onSheet.has(r.f.id))
      .map((r) => ({
        id: r.f.id,
        text: `Q${qs.indexOf(r) + 1} ${r.f.title} (${needsAnswer(r) ? 'already handled for this firm' : 'answered'})`,
      })),
    ...prior.answered.map((r) => ({
      id: r.f.id,
      text: `${r.f.title} (already answered${r.prior?.fund_name ? `, ${r.prior.fund_name}` : ''})`,
    })),
    ...prior.awaiting.map((r) => ({
      id: r.f.id,
      text: `${r.f.title} (awaiting counsel${r.prior?.fund_name ? `, ${r.prior.fund_name}` : ''})`,
    })),
  ];

  const toggleAi = async () => {
    if (drafts.useAi) {
      setUseAi(false);
      showToast('Showing the template draft.');
      return;
    }
    const missing = qs.filter((r) => !drafts.ai[r.f.id]);
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
        <div className="tt">
          <h1 id="h-counsel" tabIndex={-1}>
            Counsel questions
          </h1>
          <p className="meta" data-testid="counsel-meta">
            {doc
              ? `${qs.length} question${qs.length === 1 ? '' : 's'} · ${open.length} unanswered`
              : 'No document open'}
          </p>
        </div>
        {doc ? (
          <div className="hacts">
            <div className="seg" role="group" aria-label="Show questions">
              <button
                type="button"
                data-testid="counsel-filter-all"
                aria-pressed={filter === 'all'}
                onClick={() => setFilter('all')}
              >
                All <span>{qs.length}</span>
              </button>
              <button
                type="button"
                data-testid="counsel-filter-open"
                aria-pressed={filter === 'open'}
                onClick={() => setFilter('open')}
              >
                Unanswered <span>{open.length}</span>
              </button>
            </div>
            <button
              type="button"
              className="btn"
              data-testid="counsel-ai-draft"
              aria-pressed={drafts.useAi}
              disabled={!aiOn || aiState === 'running' || !qs.length}
              title={aiOn ? undefined : 'AI review is off'}
              onClick={() => void toggleAi()}
            >
              <Icon name="spark" />
              {aiState === 'running' ? 'Drafting…' : 'AI draft'}
            </button>
            <button
              type="button"
              className="btn pri"
              data-testid="counsel-export"
              onClick={() => setExportOpen(true)}
            >
              <Icon name="doc" />
              Export DOCX
            </button>
          </div>
        ) : null}
      </header>
      {doc ? (
        <div
          className={gateN ? 'gline' : 'gline ready'}
          role="status"
          data-testid="counsel-gate-line"
        >
          <Icon name={gateN ? 'lock' : 'unlock'} />
          {gateN ? (
            <>
              <span>
                Digitization is blocked · {gateN} critical item{gateN > 1 ? 's' : ''} open
              </span>
              <button
                className="btn lnk"
                type="button"
                aria-haspopup="dialog"
                data-testid="counsel-gate-reasons"
                onClick={() => requestAnimationFrame(() => openGate(true))}
              >
                See reasons
              </button>
              <span className="tail">
                Accepting a finding does not open the gate. Only a counsel answer does.
              </span>
            </>
          ) : (
            <span>Ready to digitize · every critical item is resolved</span>
          )}
        </div>
      ) : null}
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
            <ul className="rows" data-testid="counsel-list">
              {shown.length ? (
                shown.map(([r, n]) => (
                  <QuestionRow
                    key={r.f.id}
                    r={r}
                    n={n}
                    selected={sel === r.f.id}
                    mode={sel === r.f.id ? mode : 'view'}
                    defaultBy={defaultBy}
                    onToggle={() => {
                      setSel(sel === r.f.id ? null : r.f.id);
                      setMode('view');
                    }}
                    onMode={setMode}
                  />
                ))
              ) : (
                <li className="empty2" data-testid="counsel-none">
                  {qs.length
                    ? 'Every question on this sheet has an answer. You can still export it.'
                    : 'No questions yet. Mark a finding "Needs counsel" in Findings and it appears here.'}
                </li>
              )}
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
                <span className="help">Not exported to counsel</span>
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
            <MetricsPanel docId={doc.id} refresh={metricsSeq} />
          </>
        )}
      </div>
      {doc && result ? (
        <ExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          sheet={sheet}
          rowsById={rowsById}
          leftOut={leftOut}
          wording={wording}
          gateCount={gateN}
          noFirm={!doc.firmId}
          onDownload={async () => {
            const out = await exportCounselSheet({
              doc,
              sheet,
              rows,
              findings: result.findings,
              memory,
              wording,
            });
            setExportOpen(false);
            setMetricsSeq((n) => n + 1);
            showToast(
              `Query sheet exported: ${out.questionCount} question${out.questionCount === 1 ? '' : 's'}.` +
                (out.recorded ? '' : ' The export is not recorded in memory.'),
            );
          }}
        />
      ) : null}
    </section>
  );
}
