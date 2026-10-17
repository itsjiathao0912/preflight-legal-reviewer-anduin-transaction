import { parseQuestionKey, type Owner } from '@aduin/core';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/ui/icon';
import { useReview } from '../../state/review';
import { useSession } from '../../state/session';
import { useShell } from '../../state/shell';
import { useGatePopover } from '../gate/gate-store';
import { MetricsPanel } from '../metrics/MetricsPanel';
import { useReviewView } from '../review/use-review-view';
import {
  itemNeedsAnswer,
  OWNER_LABEL,
  OWNER_ORDER,
  questionItems,
  type QuestionItem,
} from '../variance/owner-groups';
import { useVariance } from '../variance/variance-store';
import { fetchAiDrafts } from './ai-draft';
import { useCounsel } from './counsel-store';
import { ExportDialog } from './ExportDialog';
import { GpRequestGroup } from './GpRequestGroup';
import { exportCounselSheet } from './export-flow';
import { PriorCard } from './PriorCard';
import { QuestionRow, type RowMode } from './QuestionRow';
import {
  aiDraftRows,
  buildSheet,
  needsAnswer,
  priorItems,
  questionRows,
  wordingFor,
} from './sheet-model';

type OwnerTab = 'all' | Owner;

/**
 * Questions (app.html `#counsel`, Phase 08; renamed and owner-grouped in Variance P04): compact gate
 * line, one row per question (expand for quote, A/B/C readings, provenance, inline wording edit and
 * Record answer), the collapsed "Already answered (n) · Awaiting counsel (n)" section, and Export
 * DOCX with a preview of the unanswered New/Accepted questions only (D-1). With change questions the
 * owner tabs `All · Counsel n · GP n · Fund admin n` (unanswered counts from the shared selector)
 * and one export per owner appear; Intake's GP request group stays on every tab.
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
  const [tab, setTab] = useState<OwnerTab>('all');
  /** Owner of the export dialog (null = the full sheet). */
  const [exportOwner, setExportOwner] = useState<Owner | null>(null);
  const vMeta = useVariance((s) => (s.docId === doc?.id ? s.result?.meta : undefined));
  const regMeta = view.regressionMeta;
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
  const items = useMemo(() => questionItems(rows), [rows]);
  const prior = useMemo(() => priorItems(rows), [rows]);
  // Variance P04: owner sections only when change questions exist (error-only = Phase 08 list)
  const grouped = items.some((q) => q.change) || view.hasChanges;
  const ownerN = view.counts.owners;
  const openItems = items.filter(itemNeedsAnswer);
  const inTab = (q: QuestionItem) => tab === 'all' || q.owner === tab;
  const numbered = items.map((q, i) => [q, i + 1] as const);
  const shown = numbered.filter(([q]) => inTab(q) && (filter === 'all' || itemNeedsAnswer(q)));
  const gateN = view.gate.reasons.length;
  const candidateOf = (id: string) => (vMeta?.[id] ?? regMeta[id])?.assertion_candidate;
  const defaultBy = doc?.firmName ? `Counsel, ${doc.firmName}` : 'Counsel';

  // gate popover links: open the question (or the prior item) and bring it into view
  useEffect(() => {
    if (!focus) return;
    const id = focus.id;
    // a question key (owner reason) or a plain finding id (first question of that finding)
    const hit = items.find((q) => q.key === id) ?? items.find((q) => q.findingId === id);
    if (hit) {
      setFilter('all');
      setTab('all');
      setSel(hit.key);
      setMode('view');
      requestAnimationFrame(() => {
        const b = document.querySelector<HTMLElement>(
          `[data-testid="counsel-row"][data-key="${CSS.escape(hit.key)}"] .rowb`,
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
      title: exportOwner
        ? `Questions for ${OWNER_LABEL[exportOwner]} · ${doc?.fund || doc?.name || 'Document'}`
        : `Counsel query sheet · ${doc?.fund || doc?.name || 'Document'}`,
      firm: doc?.firmId ? doc.firmName || null : null,
      fund: doc?.fund || null,
      version: doc?.version || null,
    }),
    [doc, exportOwner],
  );
  const sheet = useMemo(
    () => buildSheet(meta, rows, exportOwner ?? undefined),
    [meta, rows, exportOwner],
  );
  const rowsById = useMemo(() => new Map(rows.map((r) => [r.f.id, r])), [rows]);
  // question key -> wording (a key `<findingId>@<owner>` resolves its row by the plain id)
  const wording = (key: string) => {
    const r = rowsById.get(parseQuestionKey(key).findingId);
    return r ? wordingFor(r, drafts, key).text : '';
  };
  const onSheet = new Set(sheet.questions.map((q) => q.findingKey));
  const scoped = exportOwner ? items.filter((q) => q.owner === exportOwner) : items;
  const withPrior = !exportOwner || exportOwner === 'counsel';
  const leftOut = [
    ...scoped
      .filter((q) => !onSheet.has(q.key))
      .map((q) => ({
        id: q.key,
        text: `Q${items.indexOf(q) + 1} ${q.row.f.title}${q.change ? ` · ${OWNER_LABEL[q.owner]}` : ''} (${(q.change ? itemNeedsAnswer(q) : needsAnswer(q.row)) ? 'already handled for this firm' : 'answered'})`,
      })),
    ...(withPrior ? prior.answered : []).map((r) => ({
      id: r.f.id,
      text: `${r.f.title} (already answered${r.prior?.fund_name ? `, ${r.prior.fund_name}` : ''})`,
    })),
    ...(withPrior ? prior.awaiting : []).map((r) => ({
      id: r.f.id,
      text: `${r.f.title} (awaiting counsel${r.prior?.fund_name ? `, ${r.prior.fund_name}` : ''})`,
    })),
  ];
  const openExport = (o: Owner | null) => {
    setExportOwner(o);
    setExportOpen(true);
  };

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
        <div className="tt">
          <h1 id="h-counsel" tabIndex={-1}>
            Questions
          </h1>
          <p className="meta" data-testid="counsel-meta">
            {doc
              ? `${items.length} question${items.length === 1 ? '' : 's'} · ${openItems.length} unanswered`
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
                All <span>{items.length}</span>
              </button>
              <button
                type="button"
                data-testid="counsel-filter-open"
                aria-pressed={filter === 'open'}
                onClick={() => setFilter('open')}
              >
                Unanswered <span>{openItems.length}</span>
              </button>
            </div>
            {grouped ? (
              <div className="seg" role="group" aria-label="Questions by owner">
                {(['all', ...OWNER_ORDER] as OwnerTab[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    data-testid={`questions-tab-${k}`}
                    data-count={k === 'all' ? openItems.length : ownerN[k]}
                    aria-pressed={tab === k}
                    onClick={() => setTab(k)}
                  >
                    {k === 'all' ? 'All' : OWNER_LABEL[k]}{' '}
                    <span>{k === 'all' ? openItems.length : ownerN[k]}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              className="btn"
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
              className="btn pri"
              data-testid={tab === 'all' ? 'counsel-export' : 'questions-export-owner'}
              data-owner={tab === 'all' ? undefined : tab}
              onClick={() => openExport(tab === 'all' ? null : tab)}
            >
              <Icon name="doc" />
              {tab === 'all' ? 'Export DOCX' : `Export for ${OWNER_LABEL[tab]} (DOCX)`}
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
            <GpRequestGroup />
            <ul className="rows" data-testid="counsel-list">
              {shown.length ? (
                (grouped && tab === 'all' ? OWNER_ORDER : [null]).flatMap((o) => {
                  const list = o ? shown.filter(([q]) => q.owner === o) : shown;
                  if (!list.length) return [];
                  const all = o ? items.filter((q) => q.owner === o) : [];
                  const head = o ? (
                    <li
                      className="ghd"
                      key={`h-${o}`}
                      data-testid="questions-owner-group"
                      data-owner={o}
                    >
                      <h2>{OWNER_LABEL[o]}</h2>
                      <span className="dim">
                        {all.length} question{all.length === 1 ? '' : 's'} ·{' '}
                        {all.filter(itemNeedsAnswer).length} unanswered
                      </span>
                      <button
                        type="button"
                        className="btn sm"
                        data-testid="questions-export-owner"
                        data-owner={o}
                        disabled={!all.some(itemNeedsAnswer)}
                        title={
                          all.some(itemNeedsAnswer)
                            ? undefined
                            : `Every question for ${OWNER_LABEL[o]} has an answer`
                        }
                        onClick={() => openExport(o)}
                      >
                        <Icon name="doc" />
                        Export for {OWNER_LABEL[o]} (DOCX)
                      </button>
                    </li>
                  ) : null;
                  return [
                    ...(head ? [head] : []),
                    ...list.map(([q, n]) => (
                      <QuestionRow
                        key={q.key}
                        q={q}
                        n={n}
                        selected={sel === q.key}
                        mode={sel === q.key ? mode : 'view'}
                        defaultBy={defaultBy}
                        candidate={q.change ? candidateOf(q.findingId) : undefined}
                        onToggle={() => {
                          setSel(sel === q.key ? null : q.key);
                          setMode('view');
                        }}
                        onMode={setMode}
                      />
                    )),
                  ];
                })
              ) : (
                <li className="empty2" data-testid="counsel-none">
                  {items.some(inTab)
                    ? 'Every question on this sheet has an answer. You can still export it.'
                    : grouped
                      ? 'No questions yet. Use Ask owner on a change, or Needs counsel on an error, in Findings.'
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
          onOpenChange={(o) => {
            setExportOpen(o);
            if (!o) setExportOwner(null);
          }}
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
              // change rows and regression findings are on the sheet too (variance P04)
              findings: rows.map((r) => r.f),
              memory,
              wording,
            });
            setExportOpen(false);
            setExportOwner(null);
            setMetricsSeq((n) => n + 1);
            showToast(
              `Query sheet exported: ${out.questionCount} question${out.questionCount === 1 ? '' : 's'}.` +
                (out.memoryNote
                  ? ` ${out.memoryNote}`
                  : out.recorded
                    ? ''
                    : ' The export is not recorded in memory.'),
            );
          }}
        />
      ) : null}
    </section>
  );
}
