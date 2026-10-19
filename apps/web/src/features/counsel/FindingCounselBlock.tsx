import {
  parseQuestionKey,
  type CounselSheetAnswer,
  type CounselSheetQuestion,
  type CounselSheetResponse,
} from '@aduin/core';
import { useState } from 'react';
import { postCounselAnswer } from '../../api/counselShareApi';
import { Icon } from '../../components/ui/icon';
import { useReview } from '../../state/review';
import type { Row } from '../review/model';
import { AnswerForm, RecordedAnswerView } from './AnswerForm';
import { CommentList } from './CommentList';
import { refreshSheet, useShare } from './counsel-share';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** The shared question of one finding (a counsel or unowned question first), or null. */
export function questionForFinding(
  sheet: CounselSheetResponse | null,
  findingId: string,
): CounselSheetQuestion | null {
  const qs = (sheet?.questions ?? []).filter(
    (q) => parseQuestionKey(q.finding_key).findingId === findingId,
  );
  return qs.find((q) => !q.owner || q.owner === 'counsel') ?? qs[0] ?? null;
}

/** Latest active answer of one question. */
export function answerFor(
  sheet: CounselSheetResponse | null,
  questionId: string,
): CounselSheetAnswer | null {
  let best: CounselSheetAnswer | null = null;
  for (const a of sheet?.answers ?? [])
    if (a.question_id === questionId && (!best || a.answered_at >= best.answered_at)) best = a;
  return best;
}

/**
 * Counsel share link, inside the Findings v2 detail of one finding (both roles share the same
 * canvas). Counsel: a finding the analyst sent shows the recorded answer, "Answer" (A/B/C or
 * unclear + note, under the joined name) and the comment thread; any other finding shows
 * "Not sent to counsel". Analyst (once a share exists): the shared answer and the same thread.
 */
export function FindingCounselBlock({ row }: { row: Row }) {
  const role = useShare((s) => s.role);
  const sheet = useShare((s) => s.sheet);
  const counselName = useShare((s) => s.counselName) ?? 'Counsel';
  const showToast = useReview((s) => s.showToast);
  const [answering, setAnswering] = useState(false);
  const counsel = role === 'counsel';
  if (!counsel && !sheet) return null;
  const q = questionForFinding(sheet, row.f.id);
  if (!q) {
    return counsel ? (
      <p className="fv2-sec dim" data-testid="counsel-not-sent">
        Not sent to counsel
      </p>
    ) : null;
  }
  const a = answerFor(sheet, q.id);
  const readings = q.interpretations.length ? q.interpretations : row.f.detail.interpretations;
  const reading = (o: string) => {
    const i = LETTERS.indexOf(o);
    return i >= 0 ? (readings[i] ?? null) : null;
  };
  return (
    <div
      className="fv2-sec fv2-counsel"
      data-testid="finding-counsel-block"
      data-question-id={q.id}
      data-answered={a ? 'true' : 'false'}
    >
      <p className="fv2-sec-h">Counsel</p>
      {counsel && answering ? (
        <AnswerForm
          id={q.id}
          readings={readings}
          defaultBy={counselName}
          counselName={counselName}
          initial={{ option: a?.option ?? null, ...(a?.note ? { note: a.note } : {}) }}
          onCancel={() => setAnswering(false)}
          onSave={async (r) => {
            setAnswering(false);
            try {
              await postCounselAnswer({
                question_id: q.id,
                fingerprint: q.fingerprint,
                ...(q.quote_masked ? { quote: q.quote_masked } : {}),
                option: r.option,
                ...(r.note ? { note: r.note } : {}),
              });
              await refreshSheet();
              showToast(r.option === 'unclear' ? 'Recorded as unclear.' : 'Answer recorded.');
            } catch {
              showToast('The answer could not be saved. Try again.');
            }
          }}
        />
      ) : a ? (
        <RecordedAnswerView
          option={a.option}
          reading={reading(a.option)}
          note={a.note}
          by={a.answered_by_name}
          at={a.answered_at}
        />
      ) : (
        <p className="dim" data-testid="counsel-awaiting">
          Awaiting counsel’s answer.
        </p>
      )}
      {counsel && !answering ? (
        <div className="acts">
          <button
            type="button"
            className={a ? 'btn' : 'btn pri'}
            data-testid="counsel-record"
            onClick={() => setAnswering(true)}
          >
            <Icon name={a ? 'edit' : 'counsel'} />
            {a ? 'Change answer' : 'Answer'}
          </button>
        </div>
      ) : null}
      <CommentList questionId={q.id} />
    </div>
  );
}
