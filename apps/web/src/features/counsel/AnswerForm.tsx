import {
  mask,
  sensitiveSpans,
  type AnswerScope,
  type AssertionCandidate,
  type CounselOption,
} from '@aduin/core';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../../components/ui/icon';
import type { RecordedAnswer } from '../../state/review';
import { AssertionPreview } from '../variance/AssertionPreview';

/** Answer options: A/B/C readings plus "unclear" (keeps a critical item unresolved). */
export const UNCLEAR_TEXT =
  'Unclear: counsel could not answer. This keeps the gate blocked for a critical item.';
const LETTERS: Exclude<CounselOption, 'unclear'>[] = ['A', 'B', 'C'];

/** Intent cap (Worker: 500 chars, masked server-side). */
export const INTENT_MAX = 500;

export const INTENT_REQUIRED_TEXT =
  'Add the intent. A firm-template answer becomes a check, and the check needs a reason.';
export const INTENT_MASKED_TEXT =
  'The intent is only sensitive data once masked. Describe the reason in words.';

/**
 * Variance H8: the Worker refuses a firm-template intent whose masked form is blank (`intentIsBlank`:
 * mask tokens `#n` removed). The client applies the same rule before the answer shows as recorded.
 */
export function intentMaskedBlank(intent: string): boolean {
  const t = intent.trim().slice(0, INTENT_MAX);
  return (
    mask(t, sensitiveSpans(t))
      .replace(/#\d{0,4}/g, '')
      .trim().length === 0
  );
}

/** Client refusal for intent + scope (null = valid). Whitespace-only intent counts as empty. */
export function intentError(intent: string, scope: AnswerScope): string | null {
  if (scope !== 'firm_template') return null;
  if (!intent.trim()) return INTENT_REQUIRED_TEXT;
  if (intentMaskedBlank(intent)) return INTENT_MASKED_TEXT;
  return null;
}

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** yyyy-mm-dd (local) -> epoch ms at local noon (stable date across time zones). */
function dateMs(v: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return Date.now();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).getTime();
}

function isoDay(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function AnswerForm({
  id,
  readings,
  defaultBy,
  initial,
  onSave,
  onCancel,
  variance,
}: {
  id: string;
  /** Interpretation texts for A/B/C (at most three are offered). */
  readings: readonly string[];
  defaultBy: string;
  initial?: {
    option?: CounselOption | null;
    note?: string;
    by?: string;
    at?: number;
    intent?: string;
    scope?: AnswerScope;
  };
  onSave: (a: RecordedAnswer) => void | Promise<void>;
  onCancel: () => void;
  /**
   * Variance P04 (D1): intent + scope + preview for a change question. `candidate` is the
   * worker-decoded `assertion_candidate` (a firm-template answer then creates that check).
   */
  variance?: { candidate: AssertionCandidate | undefined; owner: string };
}) {
  // change questions mark option A as the default (D1); error questions keep no preselection
  const [option, setOption] = useState<CounselOption | null>(
    initial?.option ?? (variance ? 'A' : null),
  );
  const [note, setNote] = useState(initial?.note ?? '');
  const [by, setBy] = useState(initial?.by ?? defaultBy);
  const [when, setWhen] = useState(initial?.at ? isoDay(initial.at) : today());
  // intent is human text only: no default value, no auto-fill, no AI draft path (AC-V15)
  const [intent, setIntent] = useState(initial?.intent ?? '');
  const [scope, setScope] = useState<AnswerScope>(initial?.scope ?? 'fund');
  const [err, setErr] = useState(false);
  const [intentErr, setIntentErr] = useState<string | null>(null);
  const intentRef = useRef<HTMLTextAreaElement | null>(null);
  const first = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    first.current?.focus({ preventScroll: true });
  }, []);
  const opts: [CounselOption, string][] = [
    ...readings.slice(0, 3).map((t, i) => [LETTERS[i]!, t] as [CounselOption, string]),
    ['unclear', UNCLEAR_TEXT],
  ];
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!option || !by.trim()) {
      setErr(true);
      return;
    }
    if (variance) {
      const ie = intentError(intent, scope);
      if (ie) {
        setIntentErr(ie);
        intentRef.current?.focus();
        return;
      }
      const it = intent.trim().slice(0, INTENT_MAX);
      void onSave({
        option,
        note: note.trim(),
        by: by.trim(),
        at: dateMs(when),
        // H8: intent is sent only when non-blank (never '')
        ...(it ? { intent: it } : {}),
        scope,
        ...(scope === 'firm_template' && variance.candidate && option !== 'unclear'
          ? { assertion: { kind: 'scope_exists' as const, label: variance.candidate.label } }
          : {}),
      });
      return;
    }
    void onSave({ option, note: note.trim(), by: by.trim(), at: dateMs(when) });
  };
  return (
    <form
      className="rec"
      data-testid="answer-form"
      data-finding-id={id}
      noValidate
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <fieldset>
        <legend>Counsel&apos;s answer</legend>
        {opts.map(([k, t], i) => (
          <label className="r" key={k}>
            <input
              ref={i === 0 ? first : undefined}
              type="radio"
              name={`ans-${id}`}
              value={k}
              data-testid="answer-option"
              checked={option === k}
              onChange={() => {
                setOption(k);
                setErr(false);
              }}
            />
            <b>{k === 'unclear' ? '?' : k}</b>
            <span>
              {t}
              {variance && k === 'A' && !initial?.option ? (
                <span className="df" data-testid="answer-default">
                  Default
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </fieldset>
      <label className="f">
        Note (optional)
        <textarea
          rows={2}
          maxLength={1000}
          data-testid="answer-note"
          placeholder="For example: counsel's reasoning, or the wording to use"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {variance ? (
        <>
          <label className="f">
            Why is it written this way? (intent)
            <textarea
              ref={intentRef}
              rows={2}
              maxLength={INTENT_MAX}
              data-testid="answer-intent"
              autoComplete="off"
              value={intent}
              onChange={(e) => {
                setIntent(e.target.value);
                setIntentErr(null);
              }}
            />
          </label>
          <fieldset>
            <legend>Applies to</legend>
            <label className="r">
              <input
                type="radio"
                name={`scope-${id}`}
                value="fund"
                data-testid="answer-scope-fund"
                checked={scope === 'fund'}
                onChange={() => {
                  setScope('fund');
                  setIntentErr(null);
                }}
              />
              <span>This fund only</span>
            </label>
            <label className="r">
              <input
                type="radio"
                name={`scope-${id}`}
                value="firm_template"
                data-testid="answer-scope-firm"
                checked={scope === 'firm_template'}
                onChange={() => setScope('firm_template')}
              />
              <span>Firm template (check future documents)</span>
            </label>
          </fieldset>
          {scope === 'firm_template' ? <AssertionPreview candidate={variance.candidate} /> : null}
        </>
      ) : null}
      <div className="two">
        <label className="f">
          Answered by
          <input
            type="text"
            autoComplete="off"
            maxLength={120}
            data-testid="answer-by"
            value={by}
            onChange={(e) => {
              setBy(e.target.value);
              setErr(false);
            }}
          />
        </label>
        <label className="f">
          Date
          <input
            type="date"
            data-testid="answer-date"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
        </label>
      </div>
      <div className={err || intentErr ? 'err on' : 'err'} role="alert" data-testid="answer-error">
        {err ? (
          <>
            <Icon name="warn" />
            Choose an option or &quot;unclear&quot;, and say who answered.
          </>
        ) : intentErr ? (
          <>
            <Icon name="warn" />
            {intentErr}
          </>
        ) : null}
      </div>
      <div className="acts">
        <button type="submit" className="btn pri" data-testid="answer-save">
          <Icon name="check" />
          Save answer
        </button>
        <button type="button" className="btn" data-testid="answer-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function fmtDay(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Recorded answer shown in the app (D-1: never in the DOCX). */
export function RecordedAnswerView({
  option,
  reading,
  note,
  by,
  at,
  intent,
  scope,
}: {
  option: CounselOption;
  reading: string | null;
  note?: string | undefined;
  by?: string | undefined;
  at?: number | undefined;
  intent?: string | undefined;
  scope?: AnswerScope | undefined;
}) {
  const unclear = option === 'unclear';
  return (
    <div
      className={unclear ? 'ans unclear' : 'ans'}
      data-testid="counsel-answer"
      data-option={option}
    >
      <div className="h">
        <Icon name={unclear ? 'warn' : 'check'} />
        {unclear
          ? 'Answered "unclear". The gate stays blocked for this item.'
          : `Answered: option ${option}`}
      </div>
      {!unclear && reading ? <div>{reading}</div> : null}
      <dl>
        {note ? (
          <>
            <dt>Note</dt>
            <dd>{note}</dd>
          </>
        ) : null}
        {intent ? (
          <>
            <dt>Intent</dt>
            <dd data-testid="answer-intent-view">{intent}</dd>
          </>
        ) : null}
        {scope ? (
          <>
            <dt>Scope</dt>
            <dd data-testid="answer-scope-view">
              {scope === 'firm_template' ? 'Firm template' : 'This fund only'}
            </dd>
          </>
        ) : null}
        {by ? (
          <>
            <dt>By</dt>
            <dd>{by}</dd>
          </>
        ) : null}
        {at ? (
          <>
            <dt>Date</dt>
            <dd>{fmtDay(at)}</dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}
