import type { CounselOption } from '@aduin/core';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../../components/ui/icon';
import type { RecordedAnswer } from '../../state/review';

/** Answer options: A/B/C readings plus "unclear" (keeps a critical item unresolved). */
export const UNCLEAR_TEXT =
  'Unclear: counsel could not answer. This keeps the gate blocked for a critical item.';
const LETTERS: Exclude<CounselOption, 'unclear'>[] = ['A', 'B', 'C'];

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
}: {
  id: string;
  /** Interpretation texts for A/B/C (at most three are offered). */
  readings: readonly string[];
  defaultBy: string;
  initial?: { option?: CounselOption | null; note?: string; by?: string; at?: number };
  onSave: (a: RecordedAnswer) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [option, setOption] = useState<CounselOption | null>(initial?.option ?? null);
  const [note, setNote] = useState(initial?.note ?? '');
  const [by, setBy] = useState(initial?.by ?? defaultBy);
  const [when, setWhen] = useState(initial?.at ? isoDay(initial.at) : today());
  const [err, setErr] = useState(false);
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
            <span>{t}</span>
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
      <div className={err ? 'err on' : 'err'} role="alert" data-testid="answer-error">
        {err ? (
          <>
            <Icon name="warn" />
            Choose an option or &quot;unclear&quot;, and say who answered.
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
}: {
  option: CounselOption;
  reading: string | null;
  note?: string | undefined;
  by?: string | undefined;
  at?: number | undefined;
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
