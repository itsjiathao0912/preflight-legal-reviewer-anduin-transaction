import { maskQuote, templateInterpretations, type AssertionCandidate } from '@aduin/core';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/ui/icon';
import { useReview } from '../../state/review';
import { useSession } from '../../state/session';
import { AI_SUGGESTION } from '../ai/Provenance';
import { memoryLabelText } from '../review/memory-labels';
import type { Row } from '../review/model';
import { SEV } from '../review/severity';
import { OWNER_LABEL, type QuestionItem } from '../variance/owner-groups';
import { AnswerForm, fmtDay, RecordedAnswerView } from './AnswerForm';
import { useCounsel } from './counsel-store';
import { baseWording, itemState, wordingFor, type QuestionState } from './sheet-model';

export type RowMode = 'view' | 'edit' | 'answer';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function Tag({ state }: { state: QuestionState }) {
  switch (state) {
    case 'answered':
      return (
        <span className="tag t-ok">
          <Icon name="check" />
          Answered
        </span>
      );
    case 'unclear':
      return (
        <span className="tag t-warn">
          <Icon name="warn" />
          Unclear
        </span>
      );
    case 'accepted':
      return (
        <span className="tag t-st">
          <Icon name="check" />
          Accepted
        </span>
      );
    case 'new':
      return <span className="tag t-new">New</span>;
  }
}

/** Readings A/B/C: change questions use the engine's deterministic old-vs-new options (C3). */
export function readingsFor(r: Row): string[] {
  return r.f.kind === 'change' && r.f.detail.interpretations.length
    ? r.f.detail.interpretations
    : templateInterpretations(r.f.issue_class);
}

function WordingEditor({ r, k, onDone }: { r: Row; k: string; onDone: () => void }) {
  const drafts = useCounsel((s) => s.drafts);
  const setEdit = useCounsel((s) => s.setEdit);
  const showToast = useReview((s) => s.showToast);
  const [v, setV] = useState(wordingFor(r, drafts, k).text);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  const base = baseWording(r, drafts);
  const save = () => {
    const t = v.trim();
    if (!t) {
      showToast('Wording cannot be empty.');
      ref.current?.focus();
      return;
    }
    setEdit(k, t === base.text ? null : t);
    showToast('Wording saved.');
    onDone();
  };
  const id = `cs-ed-${k}`;
  return (
    <div className="edit">
      <label className="sr" htmlFor={id}>
        Question wording
      </label>
      <textarea
        id={id}
        ref={ref}
        rows={3}
        maxLength={2000}
        data-testid="counsel-edit-text"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onDone();
          }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
        }}
      />
      <div className="acts">
        <button type="button" className="btn pri" data-testid="counsel-edit-save" onClick={save}>
          <Icon name="check" />
          Save wording
        </button>
        <button type="button" className="btn" data-testid="counsel-edit-cancel" onClick={onDone}>
          Cancel
        </button>
        {drafts.edits[k] ? (
          <button
            type="button"
            className="btn lnk"
            data-testid="counsel-edit-reset"
            onClick={() => {
              setEdit(k, null);
              showToast('Wording reset to the draft.');
              onDone();
            }}
          >
            Reset to {base.source === 'ai' ? 'AI' : 'template'} draft
          </button>
        ) : null}
        <span className="hint">Ctrl or Cmd + Enter saves. Esc cancels.</span>
      </div>
    </div>
  );
}

function ProvenanceTags({ r, k }: { r: Row; k: string }) {
  const drafts = useCounsel((s) => s.drafts);
  const aiOn = useSession((s) => s.aiOn);
  const w = wordingFor(r, drafts, k);
  const base = w.source === 'edit' ? baseWording(r, drafts).source : w.source;
  return (
    <>
      {base === 'ai' ? (
        <>
          <span className="tag t-ai" data-testid="counsel-ai-chip">
            <Icon name="spark" />
            {AI_SUGGESTION}
          </span>
          <span>{drafts.aiModel ?? 'AI'} · AI draft, check before sending</span>
        </>
      ) : (
        <>
          <span className="tag t-st" data-testid="counsel-template-chip">
            <Icon name="rule" />
            Template draft
          </span>
          <span>
            {r.f.detector_kind === 'rule' ? `from rule ${r.f.detector_id}` : 'template wording'}
            {aiOn ? '' : ' (AI is off)'}
          </span>
        </>
      )}
      {w.source === 'edit' ? (
        <span className="tag t-st" data-testid="counsel-edited-chip">
          <Icon name="edit" />
          Edited by you
        </span>
      ) : null}
    </>
  );
}

export function QuestionRow({
  q,
  n,
  selected,
  mode,
  defaultBy,
  candidate,
  onToggle,
  onMode,
}: {
  q: QuestionItem;
  n: number;
  selected: boolean;
  mode: RowMode;
  defaultBy: string;
  /** Variance: worker-decoded `assertion_candidate` of a change question (firm-template preview). */
  candidate?: AssertionCandidate | undefined;
  onToggle: () => void;
  onMode: (m: RowMode) => void;
}) {
  const r = q.row;
  const k = q.key;
  const drafts = useCounsel((s) => s.drafts);
  const recordAnswer = useReview((s) => s.recordAnswer);
  const state = itemState(q);
  const readings = readingsFor(r);
  const t = r.triage;
  // this question's recorded answer: the owner's answer for a change question
  const info = q.change ? t?.ownerAnswerInfo?.[q.owner] : undefined;
  const rec = q.change
    ? {
        option: q.answer,
        note: info?.note,
        by: info?.by,
        at: info?.at,
        intent: info?.intent,
        scope: info?.scope,
      }
    : {
        option: t?.counselAnswer ?? null,
        note: t?.counselNote,
        by: t?.answeredBy,
        at: t?.answeredAt,
        intent: undefined,
        scope: undefined,
      };
  const reconfirm = r.label === 'dismissed_reconfirm' && state !== 'answered';
  const reading = (o: string | null | undefined) => {
    const i = o ? LETTERS.indexOf(o) : -1;
    return i >= 0 ? (readings[i] ?? null) : null;
  };
  return (
    <li
      className={selected ? 'row sel' : 'row'}
      data-testid="counsel-row"
      data-finding-id={r.f.id}
      data-key={k}
      data-owner={q.owner}
      data-kind={q.change ? 'change' : 'error'}
      data-state={state}
    >
      <button
        className="rowb"
        type="button"
        data-testid="counsel-row-toggle"
        aria-expanded={selected}
        onClick={onToggle}
      >
        <span className={`si sv-${r.sev}`}>
          <Icon name={SEV[r.sev].icon} />
          <span className="sr">{SEV[r.sev].label}: </span>
        </span>
        <span className="t">
          <span className="qn">Q{n}</span>
          <span data-testid="counsel-question-text">{wordingFor(r, drafts, k).text}</span>
        </span>
        <span className="rm">
          {reconfirm ? (
            <span className="re" title={memoryLabelText(r.label, r.prior?.fund_name)}>
              <Icon name="memory" />
              <span className="sr">{memoryLabelText(r.label, r.prior?.fund_name)}. </span>
            </span>
          ) : null}
          {q.change ? (
            <span className="ochip" data-testid="question-owner">
              {OWNER_LABEL[q.owner]}
            </span>
          ) : null}
          <Tag state={state} />
          <span>{r.f.ref}</span>
        </span>
      </button>
      {selected ? (
        <div className="rbody">
          {mode === 'edit' ? <WordingEditor r={r} k={k} onDone={() => onMode('view')} /> : null}
          <blockquote className="ev" data-testid="counsel-quote">
            {maskQuote(r.f.quote)}
            <span className="cite">
              <Icon name="pin" />
              {r.f.loc}
            </span>
          </blockquote>
          <ul className="interp" aria-label="Possible readings">
            {readings.map((txt, i) => (
              <li key={i} data-testid="counsel-interp">
                <b>{LETTERS[i]}</b>
                <span>{txt}</span>
              </li>
            ))}
          </ul>
          <div className="prov" data-testid="counsel-provenance">
            <ProvenanceTags r={r} k={k} />
            {mode !== 'edit' ? (
              <button
                type="button"
                className="btn sm lnk"
                data-testid="counsel-edit"
                onClick={() => onMode('edit')}
              >
                <Icon name="edit" />
                Edit wording
              </button>
            ) : null}
          </div>
          {reconfirm && r.prior ? (
            <p className="memnote" data-testid="counsel-reconfirm-note">
              <b>{r.prior.decided_by_name}</b> dismissed this in{' '}
              {r.prior.fund_name || 'another fund'} on {fmtDay(r.prior.decided_at)}. A counsel
              answer counts as the re-confirmation.
            </p>
          ) : null}
          {mode === 'answer' ? (
            <AnswerForm
              id={k}
              readings={readings}
              defaultBy={q.change ? OWNER_LABEL[q.owner] : defaultBy}
              initial={{
                option: rec.option,
                ...(rec.note ? { note: rec.note } : {}),
                ...(rec.by ? { by: rec.by } : {}),
                ...(rec.at ? { at: rec.at } : {}),
                ...(rec.intent ? { intent: rec.intent } : {}),
                ...(rec.scope ? { scope: rec.scope } : {}),
              }}
              {...(q.change ? { variance: { candidate, owner: OWNER_LABEL[q.owner] } } : {})}
              onCancel={() => onMode('view')}
              onSave={async (a) => {
                onMode('view');
                await recordAnswer(r.f.id, a, q.change ? q.owner : undefined);
              }}
            />
          ) : rec.option ? (
            <>
              <RecordedAnswerView
                option={rec.option}
                reading={reading(rec.option)}
                note={rec.note}
                by={rec.by}
                at={rec.at}
                intent={rec.intent}
                scope={rec.scope}
              />
              <div className="acts">
                <button
                  type="button"
                  className="btn"
                  data-testid="counsel-record"
                  onClick={() => onMode('answer')}
                >
                  <Icon name="edit" />
                  Change answer
                </button>
              </div>
            </>
          ) : (
            <div className="acts">
              <button
                type="button"
                className="btn pri"
                data-testid="counsel-record"
                onClick={() => onMode('answer')}
              >
                <Icon name="counsel" />
                Record answer
              </button>
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}
