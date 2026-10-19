import type { FindingView } from '../../../engine/types';
import { useEffect } from 'react';
import { Icon } from '../../../components/ui/icon';
import { useReview } from '../../../state/review';
import { LocatorChip } from '../../ai/Locator';
import { AI_SUGGESTION, Provenance } from '../../ai/Provenance';
import { useCounsel } from '../../counsel/counsel-store';
import { FindingCounselBlock } from '../../counsel/FindingCounselBlock';
import { EMPTY_DRAFTS, wordingFor } from '../../counsel/sheet-model';
import { fileLabel, openPackageFile } from '../../package/open-file';
import { usePackageView } from '../../package/package-view';
import { sourceFilesFor } from '../../package/source-files';
import { memoryLabelText } from '../memory-labels';
import type { Row } from '../model';
import { reasonLabel } from '../reasons';
import { SEV } from '../severity';
import { isBlocking } from './groups';
import { QuoteBody } from './QuoteBody';

const letter = (i: number): string => String.fromCharCode(65 + i);

/** Same date format as the superseded FindingRow (copied, E-B4: that file is removed in B6). */
function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * D6 expanded block for rule and AI rows, stacked: severity line (+ "AI agrees"), What's wrong,
 * the quote, Question for counsel (real counsel draft wording; open on blocking and A/B rows; A/B
 * as plain text), collapsed Details. All text is rendered as React text nodes.
 */
export function ExpandedBlock({ row, twin }: { row: Row; twin?: FindingView | undefined }) {
  const f = row.f;
  const sev = SEV[row.sev];
  const docId = useReview((s) => s.doc?.id ?? null);
  const loadDrafts = useCounsel((s) => s.load);
  const drafts = useCounsel((s) => (s.docId === docId ? s.drafts : EMPTY_DRAFTS));
  useEffect(() => {
    void loadDrafts(docId);
  }, [docId, loadDrafts]);
  const pkg = usePackageView();
  const blockIndex = useReview((s) => {
    const i = s.result?.blocks.findIndex((b) => b.id === f.anchor.blockId) ?? -1;
    return i < 0 ? null : i;
  });
  const sources = sourceFilesFor(f, pkg, blockIndex);
  const readings = f.detail.interpretations;
  const question = wordingFor(row, drafts).text;
  const qOpen = isBlocking(row) || readings.length > 0;
  const hint = readings.length ? 'Counsel will choose A or B' : 'Counsel will confirm the wording';
  const reconfirm = row.label === 'dismissed_reconfirm' && row.status !== 'dismissed';
  const prior = row.label !== 'new' ? row.prior : undefined;
  const dismissedReason = row.status === 'dismissed' ? row.triage?.reasonCode : undefined;
  return (
    <>
      <p className="fv2-sec-h fv2-sevline">
        <span className={`sv-${row.sev}`}>
          <Icon name={sev.icon} />
        </span>
        <b>{sev.label}</b> · {f.loc}
        {twin ? (
          <span
            className="fv2-tag fv2-tag-ai"
            data-testid="ai-agrees-tag"
            title="An AI review flagged the same place and class. Shown once."
          >
            <Icon name="spark" />
            AI agrees
          </span>
        ) : null}
        {f.detector_kind === 'ai' ? (
          <span className="fv2-tag fv2-tag-ai" data-testid="ai-tag">
            <Icon name="spark" />
            {AI_SUGGESTION}
          </span>
        ) : null}
        <span className="fv2-tag" data-testid="finding-memory-tag">
          {row.label !== 'new' ? <Icon name="memory" /> : null}
          {memoryLabelText(row.label, row.prior?.fund_name)}
        </span>
      </p>
      {prior ? (
        <p className="memnote">
          <b>{prior.decided_by_name}</b>{' '}
          {prior.decision === 'dismissed'
            ? 'dismissed'
            : prior.decision === 'accepted'
              ? 'accepted'
              : 'recorded counsel’s answer on'}{' '}
          this in {prior.fund_name || 'another fund'} on {fmtDate(prior.decided_at)}
          {prior.reason_code ? ` (${reasonLabel(prior.reason_code)})` : ''}.
          {reconfirm
            ? ' Blocks digitization, so it stays in the main list until you re-confirm.'
            : ''}
        </p>
      ) : null}
      {dismissedReason ? (
        <div className="fv2-sec" data-testid="finding-dismissed-reason">
          <p className="dim">{`Reason: ${reasonLabel(dismissedReason)}`}</p>
          {row.triage?.note ? <p className="dim">{row.triage.note}</p> : null}
        </div>
      ) : null}
      <div className="fv2-sec">
        <p className="fv2-sec-h">What’s wrong</p>
        <p>{f.detail.explanation}</p>
        {f.detail.expected || f.found ? (
          <dl className="fv2-kv">
            <dt>Expected</dt>
            <dd data-testid="finding-expected">{f.detail.expected ?? '—'}</dd>
            <dt>Found</dt>
            <dd data-testid="finding-found">{f.found ?? '—'}</dd>
          </dl>
        ) : null}
      </div>
      <blockquote className="fv2-quote" data-testid="finding-quote">
        <QuoteBody row={row} />
      </blockquote>
      <details className="fv2-sec" data-testid="question-for-counsel" open={qOpen}>
        <summary className="fv2-sec-h">
          <Icon name="chev" />
          Question for counsel <span className="hint">{hint}</span>
        </summary>
        <p className="fv2-qfc">{question}</p>
        <p className="fv2-reading">
          {readings.length ? (
            <>
              <b>Counsel will choose:</b>{' '}
              {readings.map((t, i) => `${letter(i)}) ${t}`).join('  /  ')}
            </>
          ) : (
            'Counsel will confirm the intended wording.'
          )}
        </p>
      </details>
      <FindingCounselBlock row={row} />
      <details className="fv2-details" data-testid="finding-details">
        <summary className="fv2-sec-h">
          <Icon name="chev" />
          Details
        </summary>
        <dl className="fv2-kv">
          <dt>Where</dt>
          <dd>
            {f.loc} <LocatorChip f={f} />
          </dd>
          <dt>Class</dt>
          <dd>{f.classLabel}</dd>
          <dt>Flagged by</dt>
          <dd>
            <Provenance f={f} />
          </dd>
          {twin ? (
            <>
              <dt>AI review</dt>
              <dd>
                {twin.model ?? 'AI'} · {twin.provenance === 'cache' ? 'from cache' : 'fresh'} ·
                flagged the same place and class (agrees)
              </dd>
            </>
          ) : null}
          {sources && pkg ? (
            <>
              <dt>Source File</dt>
              <dd data-testid="finding-source-file">
                {sources.files.map((e) => (
                  <button
                    key={e.doc.id}
                    type="button"
                    className="btn ghost sm"
                    data-testid="finding-source-file-open"
                    title="Open this file in the reading pane"
                    onClick={() => openPackageFile(pkg, e.doc.id, e.blockIndex)}
                  >
                    {fileLabel(e.doc)}
                  </button>
                ))}
                {sources.missing.map((m) => (
                  <span key={m} className="dim">
                    {m}
                  </span>
                ))}
              </dd>
            </>
          ) : null}
          <dt>Confidence</dt>
          <dd>{Math.round(f.confidence * 100)}%</dd>
          <dt>Why it was flagged</dt>
          <dd>{f.detail.explanation}</dd>
        </dl>
      </details>
    </>
  );
}
