import type { ActiveDecision, Rule } from '@aduin/core';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import '../../styles/structure.css';
import '../../styles/memory.css';
import { Icon } from '../../components/ui/icon';
import { useReview } from '../../state/review';
import { useSession } from '../../state/session';
import { MemoryAuditTab } from './audit/MemoryAuditTab';
import type { DecisionRowData } from './decisions/DecisionRow';
import { DecisionsTab } from './decisions/DecisionsTab';
import { ReopenDialog } from './decisions/ReopenDialog';
import { filterAudit, humanClass, joinRevoked, matchingDismissals } from './memory-join';
import { AddRuleDialog } from './rules/AddRuleDialog';
import { DeactivateRuleDialog } from './rules/DeactivateRuleDialog';
import { ReviewRuleDialog } from './rules/ReviewRuleDialog';
import { RulesTab } from './rules/RulesTab';
import { useMemoryData } from './useMemoryData';
import { MSG } from './write';

type Tab = 'decisions' | 'rules' | 'audit';
const TABS: readonly (readonly [Tab, string])[] = [
  ['decisions', 'Decisions'],
  ['rules', 'Rules'],
  ['audit', 'Audit trail'],
];

type Dlg =
  | { kind: 'reopen'; row: DecisionRowData }
  | { kind: 'review'; rule: Rule }
  | { kind: 'add' }
  | { kind: 'deactivate'; rule: Rule };

interface Snapshot {
  d: ActiveDecision;
  rev: { who: string; at: number; reason: string };
}

const SUCCESS: Record<Dlg['kind'], string> = {
  reopen: 'Decision reopened. It is kept in the audit trail and the finding is New again.',
  review: 'Done. The change is recorded in the audit trail.',
  add: 'Rule added. It is given to the AI as context for this firm only.',
  deactivate: 'Rule deactivated. It stays in the audit trail.',
};

/**
 * Firm memory page (app.html `#v-memory`, Phase 08b): Decisions | Rules | Audit trail for the open
 * document's firm. Every write is one awaited Memory API call (never the outbox); lost races
 * refetch with "Already changed"; a read-only demo session disables every write.
 */
export function MemoryView() {
  const m = useMemoryData();
  const showToast = useReview((s) => s.showToast);
  const refreshReview = useReview((s) => s.refreshMemory);
  const findings = useReview((s) => s.result?.findings);
  const analyst = useSession((s) => s.analystName);
  const setReadOnly = useSession((s) => s.setReadOnly);
  const [tab, setTab] = useState<Tab>('decisions');
  const [dlg, setDlg] = useState<Dlg | null>(null);
  const [kept, setKept] = useState(false);
  const [snaps, setSnaps] = useState<Map<string, Snapshot>>(() => new Map());
  const infoRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // reopened-in-this-session snapshots belong to the firm they were taken for
  useEffect(() => setSnaps(new Map()), [m.firmId]);

  const labels = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of findings ?? []) map.set(f.issue_class, f.classLabel);
    return map;
  }, [findings]);
  const classLabel = useCallback(
    (code: string | null) => (code ? (labels.get(code) ?? humanClass(code)) : humanClass(null)),
    [labels],
  );

  const firmId = m.firmId;
  const decisions = useMemo(() => m.firm?.decisions ?? [], [m.firm]);
  const rows = useMemo<DecisionRowData[]>(() => {
    const active: DecisionRowData[] = decisions.map((d) => ({
      id: d.id,
      status: 'active',
      decision: d.decision,
      issueClass: d.issue_class ?? null,
      full: d,
      rev: null,
    }));
    const reopened: DecisionRowData[] = joinRevoked(decisions, m.audit, firmId ?? undefined).map(
      (r) => {
        const s = snaps.get(r.id);
        return {
          id: r.id,
          status: 'reopened',
          decision: s?.d.decision ?? r.decision,
          issueClass: s?.d.issue_class ?? r.issueClass,
          full: s?.d ?? null,
          rev: { who: r.who, at: r.at, reason: r.reason },
        };
      },
    );
    const listed = new Set(reopened.map((r) => r.id));
    // reopened in this session but its audit event is not loaded yet: keep the snapshot row
    for (const [id, s] of snaps) {
      if (listed.has(id) || decisions.some((d) => d.id === id)) continue;
      reopened.unshift({
        id,
        status: 'reopened',
        decision: s.d.decision,
        issueClass: s.d.issue_class ?? null,
        full: s.d,
        rev: s.rev,
      });
    }
    return [...active, ...reopened];
  }, [decisions, m.audit, firmId, snaps]);

  const matchingFor = useCallback(
    (rule: Rule) => matchingDismissals(rule, decisions, m.audit),
    [decisions, m.audit],
  );

  const activeRules = m.rules.filter((r) => r.status === 'active').length;
  const proposed = m.rules.filter((r) => r.status === 'proposed').length;
  const auditCount = firmId ? filterAudit(m.audit, 'all', firmId).length : 0;
  const counts: Record<Tab, number> = {
    decisions: rows.length,
    rules: activeRules,
    audit: auditCount,
  };
  const title = m.firmName && firmId ? `${m.firmName} memory` : 'Firm memory';
  const ok = m.status === 'ok' && firmId !== null;

  // ---- write results (dialogs report; this owns close, refetch and toasts)
  const onDone = async (d: Dlg, kind: 'ok' | 'changed' | 'readOnly', reason = '') => {
    setDlg(null);
    if (kind === 'readOnly') {
      setReadOnly(true);
      showToast(MSG.readOnly);
      return;
    }
    if (kind === 'ok' && d.kind === 'reopen' && d.row.full) {
      const snap: Snapshot = {
        d: d.row.full,
        rev: { who: analyst, at: Date.now(), reason },
      };
      setSnaps((prev) => new Map(prev).set(d.row.id, snap));
    }
    await m.refetch();
    if (d.kind === 'reopen') {
      const full = d.row.full;
      await refreshReview(
        kind === 'ok' ? d.row.id : undefined,
        full ? { fingerprint: full.fingerprint, decision: full.decision } : undefined,
      );
    }
    showToast(kind === 'ok' ? SUCCESS[d.kind] : MSG.changed);
  };

  // ---- segmented control: arrow keys move between tabs (roving tabindex)
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex(([k]) => k === tab);
    let n = -1;
    if (e.key === 'ArrowRight') n = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') n = (i + TABS.length - 1) % TABS.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = TABS.length - 1;
    if (n < 0) return;
    e.preventDefault();
    const next = TABS[n]![0];
    setTab(next);
    requestAnimationFrame(() => document.getElementById(`mem-t-${next}`)?.focus());
  };

  // ---- "What memory keeps" popover: Escape or an outside click closes it
  useEffect(() => {
    if (!kept) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setKept(false);
        infoRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!popRef.current?.contains(t) && !infoRef.current?.contains(t)) setKept(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [kept]);

  return (
    <section className="view memory-view" aria-labelledby="h-memory" data-testid="memory-view">
      <header className="pagehead">
        <div className="tt">
          <h1 id="h-memory" tabIndex={-1}>
            {title}
          </h1>
          <p className="meta" data-testid="memory-meta">
            {ok
              ? `${rows.length} decision${rows.length === 1 ? '' : 's'} (${m.firm?.counts.decisions ?? 0} active) · ${activeRules} rule${activeRules === 1 ? '' : 's'} · ${proposed} suggested`
              : ''}
          </p>
        </div>
        <div className="hacts">
          {ok ? (
            <div
              className="seg segx"
              role="tablist"
              aria-label="Memory views"
              data-testid="memory-tabs"
              onKeyDown={onTabKey}
            >
              {TABS.map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  id={`mem-t-${k}`}
                  data-testid={`memory-tab-${k}`}
                  aria-selected={tab === k}
                  aria-controls={`mem-p-${k}`}
                  tabIndex={tab === k ? 0 : -1}
                  onClick={() => setTab(k)}
                >
                  {l} <span className="dim">{counts[k]}</span>
                  {k === 'rules' && proposed ? (
                    <span
                      className="fl"
                      aria-label={`${proposed} pending suggestion${proposed > 1 ? 's' : ''}`}
                    >
                      {proposed}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
          <button
            ref={infoRef}
            className="ibtn"
            type="button"
            data-testid="memory-info"
            aria-expanded={kept}
            aria-controls="mem-kept"
            aria-label="What memory keeps and for how long"
            onClick={() => setKept((v) => !v)}
          >
            <Icon name="info" />
          </button>
          {kept ? (
            <div
              ref={popRef}
              id="mem-kept"
              className="pop memory-kept"
              role="dialog"
              aria-label="What memory keeps"
              tabIndex={-1}
              data-testid="memory-kept"
            >
              <h2>What memory keeps</h2>
              <p>
                <b>Kept:</b> short quoted snippets, hashes and metadata, never the full document.
                Bank and routing numbers are masked before they are stored.
              </p>
              <p>
                <b>Retention:</b> 30 days in sandbox workspaces. The shared demo workspace is not
                purged. Nothing is ever deleted from the audit trail.
              </p>
            </div>
          ) : null}
        </div>
      </header>
      <div className="pgbody">
        {m.status === 'noFirm' ? (
          <div className="empty2" data-testid="memory-no-firm">
            Open a document for a law firm to see its memory.
          </div>
        ) : m.status === 'loading' ? (
          <p className="mut" role="status" data-testid="memory-loading">
            Loading memory…
          </p>
        ) : m.status === 'unavailable' ? (
          <div className="empty2" role="status" data-testid="memory-unavailable">
            <p style={{ margin: '0 0 10px' }}>{MSG.unavailable}</p>
            <button
              className="btn"
              type="button"
              data-testid="memory-retry"
              onClick={() => void m.refetch()}
            >
              Retry
            </button>
          </div>
        ) : firmId ? (
          <>
            {m.readOnly ? (
              <p className="mut" data-testid="memory-read-only" style={{ marginBottom: 10 }}>
                This demo workspace is read-only: you can look, but changes are not saved.
              </p>
            ) : null}
            <section
              id="mem-p-decisions"
              role="tabpanel"
              aria-labelledby="mem-t-decisions"
              hidden={tab !== 'decisions'}
            >
              <DecisionsTab
                rows={rows}
                totalActive={m.firm?.counts.decisions ?? 0}
                firmName={m.firmName}
                readOnly={m.readOnly}
                classLabel={classLabel}
                onReopen={(row) => setDlg({ kind: 'reopen', row })}
              />
            </section>
            <section
              id="mem-p-rules"
              role="tabpanel"
              aria-labelledby="mem-t-rules"
              hidden={tab !== 'rules'}
            >
              <RulesTab
                rules={m.rules}
                audit={m.audit}
                firmName={m.firmName}
                readOnly={m.readOnly}
                matching={matchingFor}
                onReview={(rule) => setDlg({ kind: 'review', rule })}
                onAdd={() => setDlg({ kind: 'add' })}
                onDeactivate={(rule) => setDlg({ kind: 'deactivate', rule })}
              />
            </section>
            <section
              id="mem-p-audit"
              role="tabpanel"
              aria-labelledby="mem-t-audit"
              hidden={tab !== 'audit'}
            >
              <MemoryAuditTab
                events={m.audit}
                firmId={firmId}
                hasMore={m.nextCursor !== null}
                loading={m.auditLoading}
                onMore={() => void m.loadMoreAudit()}
              />
            </section>
          </>
        ) : null}
      </div>
      {dlg?.kind === 'reopen' ? (
        <ReopenDialog
          row={dlg.row}
          firmName={m.firmName}
          api={m.api}
          onClose={() => setDlg(null)}
          onDone={(k, why) => void onDone(dlg, k, why)}
        />
      ) : null}
      {dlg?.kind === 'review' ? (
        <ReviewRuleDialog
          rule={dlg.rule}
          matching={matchingFor(dlg.rule)}
          firmName={m.firmName}
          readOnly={m.readOnly}
          classLabel={classLabel}
          api={m.api}
          onClose={() => setDlg(null)}
          onDone={(k) => void onDone(dlg, k)}
        />
      ) : null}
      {dlg?.kind === 'add' && firmId ? (
        <AddRuleDialog
          firmId={firmId}
          firmName={m.firmName}
          api={m.api}
          onClose={() => setDlg(null)}
          onDone={(k) => void onDone(dlg, k)}
        />
      ) : null}
      {dlg?.kind === 'deactivate' ? (
        <DeactivateRuleDialog
          rule={dlg.rule}
          api={m.api}
          onClose={() => setDlg(null)}
          onDone={(k) => void onDone(dlg, k)}
        />
      ) : null}
    </section>
  );
}
