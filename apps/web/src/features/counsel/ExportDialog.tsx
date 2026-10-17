import { parseQuestionKey, type CounselSheet } from '@aduin/core';
import * as RxDialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { Icon } from '../../components/ui/icon';
import type { Row } from '../review/model';
import { ExportError } from './export-flow';
import { LETTERS, SHEET_OWNER_LABEL } from './exportDocx';

/**
 * Export preview (app.html counsel export dialog): the unanswered New/Accepted questions that go to
 * counsel, what is left out and why, and the gate warning. Download runs the export flow; a failure
 * keeps the dialog open with the message and nothing is marked exported.
 */
export function ExportDialog({
  open,
  onOpenChange,
  sheet,
  rowsById,
  leftOut,
  wording,
  gateCount,
  noFirm,
  onDownload,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sheet: CounselSheet;
  rowsById: ReadonlyMap<string, Row>;
  leftOut: { id: string; text: string }[];
  wording: (findingKey: string) => string;
  gateCount: number;
  noFirm: boolean;
  onDownload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) setError(null);
    const app = document.getElementById('app');
    if (!app) return;
    if (open) app.setAttribute('inert', '');
    else app.removeAttribute('inert');
    return () => app.removeAttribute('inert');
  }, [open]);
  const items = sheet.questions;
  // Variance P04: a question key `<findingId>@<owner>` resolves its row by the plain finding id
  const rowOf = (key: string) => rowsById.get(parseQuestionKey(key).findingId);
  const answerOf = (key: string) => {
    const { owner } = parseQuestionKey(key);
    const t = rowOf(key)?.triage;
    return owner ? (t?.ownerAnswers?.[owner] ?? null) : (t?.counselAnswer ?? null);
  };
  const acc = items.filter((q) => rowOf(q.findingKey)?.status === 'accepted').length;
  const firm = sheet.meta.firm ?? 'not tagged';
  const owner = sheet.meta.owner ? SHEET_OWNER_LABEL[sheet.meta.owner] : null;
  const to = owner ?? 'counsel';
  return (
    <RxDialog.Root open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <RxDialog.Portal>
        <RxDialog.Overlay className="scrim">
          <RxDialog.Content className="dlg wide" data-testid="export-dialog">
            <div className="dl">
              <div className="dh">
                <div>
                  <RxDialog.Title asChild>
                    <h2>{owner ? `Export for ${owner}` : 'Export preview'}</h2>
                  </RxDialog.Title>
                  <RxDialog.Description asChild>
                    <p className="mut" data-testid="export-summary">
                      {items.length
                        ? `${items.length} unanswered question${items.length > 1 ? 's' : ''} go to ${to}: ${items.length - acc} New, ${acc} Accepted. Law firm: ${firm}.`
                        : owner
                          ? `Nothing to send: every question for ${owner} has an answer.`
                          : 'Nothing to send: every question has an answer.'}
                    </p>
                  </RxDialog.Description>
                </div>
                <RxDialog.Close asChild>
                  <button className="xb" type="button" aria-label="Close preview">
                    <Icon name="x" />
                  </button>
                </RxDialog.Close>
              </div>
              {gateCount ? (
                <div className="callout" data-testid="export-gate-warning">
                  <Icon name="warn" />
                  <span>
                    The gate is still Blocked ({gateCount} item{gateCount > 1 ? 's' : ''}).
                    Exporting does not clear it. Only recorded counsel answers do.
                  </span>
                </div>
              ) : null}
              {noFirm ? (
                <div className="callout" data-testid="export-no-firm">
                  <Icon name="info" />
                  <span>
                    Memory needs a law firm tag. This sheet is exported, but its questions and
                    answers are not remembered for the next fund.
                  </span>
                </div>
              ) : null}
              <div className="pv" data-testid="export-preview">
                <h3>{sheet.meta.title}</h3>
                {items.length ? (
                  items.map((q) => {
                    const quote = q.quote.length > 110 ? `${q.quote.slice(0, 108)}…` : q.quote;
                    return (
                      <div
                        className="item"
                        key={q.findingKey}
                        data-testid="export-item"
                        data-finding-id={q.findingKey}
                      >
                        <div className="qq">
                          {q.number}. {wording(q.findingKey)}
                        </div>
                        <div className="cit">
                          {q.location} · &quot;{quote}&quot;
                        </div>
                        <ol type="A">
                          {q.interpretations.map((t, i) => (
                            <li key={LETTERS[i] ?? i}>{t}</li>
                          ))}
                        </ol>
                        <div className="ra">
                          {answerOf(q.findingKey) === 'unclear'
                            ? 'Earlier answer: unclear · follow-up needed'
                            : 'Answer: ______   Note: ______   By / date: ______'}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="out">No unanswered questions.</div>
                )}
                <div className="out" data-testid="export-left-out">
                  <b>Left out of this export ({leftOut.length})</b>
                  {leftOut.length ? (
                    <ul>
                      {leftOut.map((x) => (
                        <li key={x.id}>{x.text}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
              {error ? (
                <div className="callout" role="alert" data-testid="export-error">
                  <Icon name="warn" />
                  <span>{error}</span>
                </div>
              ) : null}
              <div className="foot">
                <span className="mut">DOCX is the only export format in this version.</span>
                <span className="acts">
                  <button
                    type="button"
                    className="btn"
                    data-testid="export-close"
                    disabled={busy}
                    onClick={() => onOpenChange(false)}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="btn pri"
                    data-testid="export-download"
                    disabled={!items.length || busy}
                    onClick={async () => {
                      setBusy(true);
                      setError(null);
                      try {
                        await onDownload();
                      } catch (e) {
                        setError(
                          e instanceof ExportError
                            ? e.message
                            : 'The query sheet could not be exported. Try again.',
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Icon name="down" />
                    {busy ? 'Exporting…' : 'Download DOCX'}
                  </button>
                </span>
              </div>
            </div>
          </RxDialog.Content>
        </RxDialog.Overlay>
      </RxDialog.Portal>
    </RxDialog.Root>
  );
}
