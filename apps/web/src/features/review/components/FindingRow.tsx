import { mask } from '@aduin/core';
import { Icon } from '../../../components/ui/icon';
import { useReview } from '../../../state/review';
import { LocatorChip } from '../../ai/Locator';
import { AI_SUGGESTION, Provenance } from '../../ai/Provenance';
import { memoryLabelText } from '../memory-labels';
import type { Row } from '../model';
import { reasonLabel } from '../reasons';
import { SEV } from '../severity';

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Quote text for the row: masked by default (core quote is already masked); Reveal shows the original. */
function QuoteBody({ r }: { r: Row }) {
  const revealed = useReview((s) => s.revealed);
  const toggle = useReview((s) => s.toggleReveal);
  const block = useReview((s) => s.result?.blocks.find((b) => b.id === r.f.anchor.blockId));
  if (r.f.sensitive.length === 0 || !block) return <>{r.f.quote_snippet}</>;
  const { offsetStart: a, offsetEnd: b } = r.f.anchor;
  const raw = block.text.slice(a, b);
  const spans = r.f.sensitive.map((s) => ({ start: s.start - a, end: s.end - a }));
  return (
    <>
      {revealed ? raw : mask(raw, spans)}
      <button
        type="button"
        className="revealbtn"
        data-testid="reveal-toggle"
        aria-pressed={revealed}
        onClick={toggle}
      >
        <Icon name={revealed ? 'eyeoff' : 'eye'} />
        {revealed ? 'Hide' : 'Reveal'}
      </button>
    </>
  );
}

function StatusIcons({ r }: { r: Row }) {
  return (
    <>
      {r.label !== 'new' ? (
        <span className="re" title={memoryLabelText(r.label, r.prior?.fund_name)}>
          <Icon name="memory" />
          <span className="sr">{memoryLabelText(r.label, r.prior?.fund_name)}. </span>
        </span>
      ) : null}
      {r.f.detector_kind === 'ai' ? (
        <span title={AI_SUGGESTION}>
          <Icon name="spark" />
          <span className="sr">{AI_SUGGESTION}. </span>
        </span>
      ) : null}
      {r.status === 'accepted' ? (
        <span title="Accepted">
          <Icon name="check" />
          <span className="sr">Accepted. </span>
        </span>
      ) : null}
      {r.status === 'counsel' ? (
        <span title="Needs counsel">
          <Icon name="counsel" />
          <span className="sr">Needs counsel. </span>
        </span>
      ) : null}
      {r.status === 'dismissed' ? (
        <span title="Dismissed">
          <Icon name="x" />
          <span className="sr">Dismissed. </span>
        </span>
      ) : null}
    </>
  );
}

export function FindingRow({
  r,
  selected,
  onDismiss,
}: {
  r: Row;
  selected: boolean;
  onDismiss: (id: string, opener: HTMLElement) => void;
}) {
  const select = useReview((s) => s.select);
  const accept = useReview((s) => s.accept);
  const needsCounsel = useReview((s) => s.needsCounsel);
  const restore = useReview((s) => s.restore);
  const sev = SEV[r.sev];
  const f = r.f;
  const reconfirm = r.label === 'dismissed_reconfirm' && r.status !== 'dismissed';
  return (
    <li className={`row${selected ? ' sel' : ''}${r.status === 'dismissed' ? ' done' : ''}`}>
      <button
        className="rowb"
        type="button"
        data-testid="finding-row"
        data-finding-id={f.id}
        data-severity={r.sev}
        data-status={r.status}
        aria-expanded={selected}
        onClick={() => select(f.id)}
      >
        <span className={`si sv-${r.sev}`}>
          <Icon name={sev.icon} />
          <span className="sr">{sev.label}: </span>
        </span>
        <span className="t" title={f.title} data-testid="finding-title">
          {f.title}
        </span>
        <span className="rm">
          <StatusIcons r={r} />
          <span>{f.ref}</span>
        </span>
      </button>
      {selected ? (
        <div className="rbody" data-testid="finding-body">
          <p className="sub2">
            <b>{sev.label}</b> · {f.classLabel} · {f.loc}
            {f.detector_kind === 'ai' ? ` · ${AI_SUGGESTION}` : ''}
          </p>
          <p className="locrow">
            <LocatorChip f={f} />
          </p>
          <blockquote className="ev" data-testid="finding-quote">
            <QuoteBody r={r} />
          </blockquote>
          {f.detail.expected || f.found ? (
            <div className="ef">
              <div>
                <div className="k">Expected</div>
                <div className="v" data-testid="finding-expected">
                  {f.detail.expected ?? '—'}
                </div>
              </div>
              <div>
                <div className="k">Found</div>
                <div className="v" data-testid="finding-found">
                  {f.found ?? '—'}
                </div>
              </div>
            </div>
          ) : null}
          <div className="prov">
            <span
              className={r.label === 'new' ? 'tag t-new' : 'tag t-re'}
              data-testid="finding-memory-tag"
            >
              {r.label !== 'new' ? <Icon name="memory" /> : null}
              {memoryLabelText(r.label, r.prior?.fund_name)}
            </span>
            <Provenance f={f} />
          </div>
          {r.prior && r.label !== 'new' ? (
            <p className="memnote">
              <b>{r.prior.decided_by_name}</b>{' '}
              {r.prior.decision === 'dismissed'
                ? 'dismissed'
                : r.prior.decision === 'accepted'
                  ? 'accepted'
                  : 'recorded counsel’s answer on'}{' '}
              this in {r.prior.fund_name || 'another fund'} on {fmtDate(r.prior.decided_at)}
              {r.prior.reason_code ? ` (${reasonLabel(r.prior.reason_code)})` : ''}.
              {reconfirm
                ? ' Blocks digitization, so it stays in the main list until you re-confirm.'
                : ''}
            </p>
          ) : null}
          <details className="more">
            <summary>
              <Icon name="chev" />
              Why it was flagged
            </summary>
            <div className="dd">
              <p>{f.detail.explanation}</p>
              {f.detail.interpretations.length ? (
                <ul className="interp" aria-label="Possible readings">
                  {f.detail.interpretations.map((t, i) => (
                    <li key={t}>
                      <b>{String.fromCharCode(65 + i)}</b>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p>Confidence: {Math.round(f.confidence * 100)}%</p>
            </div>
          </details>
          {r.status === 'dismissed' ? (
            <div className="acts">
              <button
                className="btn"
                type="button"
                data-testid="action-restore"
                onClick={() => void restore(f.id)}
              >
                <Icon name="undo" />
                Restore finding
              </button>
              {r.triage?.reasonCode ? (
                <span className="dim rsn">Reason: {reasonLabel(r.triage.reasonCode)}</span>
              ) : null}
            </div>
          ) : (
            <div className="acts">
              <button
                className="btn pri"
                type="button"
                data-testid="action-accept"
                aria-pressed={r.status === 'accepted'}
                onClick={() => void accept(f.id)}
              >
                <Icon name="check" />
                {r.status === 'accepted' ? 'Accepted' : 'Accept'}
              </button>
              <button
                className="btn"
                type="button"
                data-testid="action-dismiss"
                onClick={(e) => onDismiss(f.id, e.currentTarget)}
              >
                <Icon name="x" />
                {reconfirm ? 'Re-confirm dismissal…' : 'Dismiss…'}
              </button>
              <button
                className="btn"
                type="button"
                data-testid="action-counsel"
                aria-pressed={r.status === 'counsel'}
                onClick={() => void needsCounsel(f.id)}
              >
                <Icon name="counsel" />
                Needs counsel
              </button>
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}
