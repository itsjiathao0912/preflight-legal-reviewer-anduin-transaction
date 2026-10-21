import { useEffect, useState } from 'react';
import type { StructureView } from '@aduin/core';
import { Icon } from '../../../components/ui/icon';
import { useReview } from '../../../state/review';
import { ExportOutlineButton } from '../../outline/ExportOutlineButton';
import {
  flowItems,
  flowPath,
  questionLine,
  runLabel,
  typeStuck,
  type FlowBreak,
  type FlowStep,
} from './flow-model';
import { FlowTypePicker } from './FlowTypePicker';
import { openFinding, showInDoc } from './show';

/** One break row: opens its finding (Issues view) or, without one, shows its text. */
function BreakRow({ b }: { b: FlowBreak }) {
  const go = () => (b.findingId ? openFinding(b.findingId) : showInDoc(b.blockId));
  return (
    <button
      type="button"
      className={`fv2-flow-break${b.tag === 'Fix' ? ' w' : ''}`}
      data-testid="flow-break"
      data-kind={b.kind}
      onClick={(e) => {
        e.stopPropagation();
        go();
      }}
    >
      <Icon name={b.tag === 'Fix' ? 'warn' : 'stop'} />
      <span>
        {b.label} · {b.tag}
        {b.findingId ? <span className="fv2-flow-lnk"> · Open finding</span> : null}
      </span>
    </button>
  );
}

/** One step: the type's own questions first, then muted document-wide groups and breaks. */
function StepRow({ s }: { s: FlowStep }) {
  return (
    <li
      className={`fv2-flow-step${s.breaks.some((b) => b.tag === 'Blocks') ? ' bad' : s.breaks.length ? ' warn' : ''}`}
      data-testid="flow-step"
    >
      <span className="fv2-flow-dot" aria-hidden="true">
        {s.number}
      </span>
      <div>
        <button
          type="button"
          className="rb fv2-flow-title"
          disabled={!s.blockId}
          title="Show in document"
          onClick={() => s.blockId && showInDoc(s.blockId)}
        >
          {s.title}
          <span className="sr">, Section {s.number}, show in document</span>
        </button>
        {s.onlyType ? (
          <span className="fv2-tag fv2-tag-ai" data-testid="flow-only-type">
            Only for this type
          </span>
        ) : null}
        {s.typeQuestions.map((q, i) => (
          <p key={`t${i}`} className="fv2-flow-q">
            Question: {q}
          </p>
        ))}
        {s.questions.map((q) => (
          <p key={q.id} className="fv2-flow-q mut">
            {questionLine(q)}
          </p>
        ))}
        {s.breaks.map((b) => (
          <BreakRow key={b.id} b={b} />
        ))}
        {s.appliesTo.map((l) => (
          <p key={l} className="fv2-flow-q mut" data-testid="flow-applies-to">
            Applies to {l} only
          </p>
        ))}
      </div>
    </li>
  );
}

/** A collapsed run of identical steps; click to expand. */
function RunRow({ steps }: { steps: FlowStep[] }) {
  const [open, setOpen] = useState(false);
  if (open) return steps.map((s) => <StepRow key={s.number} s={s} />);
  return (
    <li className="fv2-flow-step" data-testid="flow-step-collapsed">
      <span className="fv2-flow-dot" aria-hidden="true">
        …
      </span>
      <div>
        <button
          type="button"
          className="rb fv2-flow-title mut"
          aria-expanded={false}
          onClick={() => setOpen(true)}
        >
          {runLabel(steps)}
        </button>
      </div>
    </li>
  );
}

/**
 * Form flow view (Document map Logic, reworked): the path one investor type walks, step by step,
 * with its questions and the real breaks inline. Reads the engine StructureView only.
 */
export function FormFlowView({ view }: { view: StructureView | undefined }) {
  const doc = useReview((s) => s.doc);
  const docKey = useReview((s) => s.result?.docHash ?? '');
  const [type, setType] = useState<string | null>(null);
  useEffect(() => setType(null), [docKey]);

  const head = (
    <div className="fv2-alt-head">
      <p className="mut">
        The form this agreement turns into. Pick an investor type to walk its path.
      </p>
      {doc ? <ExportOutlineButton /> : null}
    </div>
  );
  if (!view) {
    return (
      <>
        {head}
        <p className="mut" data-testid="flow-empty">
          {doc ? 'No structure for this document.' : 'No document is open.'}
        </p>
      </>
    );
  }
  const types = view.investors.types;
  const stuckSet = new Set(types.filter((t) => typeStuck(view, t)).map((t) => t.type));
  const firstStuck = types.find((t) => stuckSet.has(t.type))?.type;
  const current = type ?? firstStuck ?? view.investors.preselected ?? types[0]?.type ?? null;
  const path = flowPath(view, current);
  return (
    <>
      {head}
      {types.length ? (
        <div className="fv2-flow-pick">
          <span className="fv2-flow-lbl">Investor type</span>
          <FlowTypePicker
            value={current}
            onChange={setType}
            options={types.map((t) => {
              const stuck = stuckSet.has(t.type);
              const at = stuck
                ? flowPath(view, t.type).steps.find((s) => s.breaks.some((b) => b.tag === 'Blocks'))
                : undefined;
              return {
                id: t.type,
                label: t.label,
                stuck,
                note: stuck
                  ? at
                    ? `Stuck at Section ${at.number}`
                    : 'Stuck before the signature'
                  : null,
              };
            })}
          />
          <span className="fv2-flow-sum" data-testid="flow-type-summary">
            {types.length - stuckSet.size} of {types.length} reach the signature
            {stuckSet.size ? ` · ${stuckSet.size} stuck` : ''}
          </span>
        </div>
      ) : (
        <p className="mut">No investor types detected; showing every section.</p>
      )}
      <ol className="fv2-flow">
        {flowItems(path.steps).map((it) =>
          it.kind === 'step' ? (
            <StepRow key={it.step.number} s={it.step} />
          ) : (
            <RunRow key={`${current}-${it.steps[0]!.number}`} steps={it.steps} />
          ),
        )}
        {path.reaches === null ? null : (
          <li className={`fv2-flow-step${path.reaches ? '' : ' bad'}`} data-testid="flow-end">
            <span className="fv2-flow-dot" aria-hidden="true">
              <Icon name={path.reaches ? 'check' : 'stop'} />
            </span>
            <div>
              <b className="fv2-flow-end">
                {path.reaches ? 'Signature reached' : 'Signature not reached'}
              </b>
            </div>
          </li>
        )}
      </ol>
      {path.other.length ? (
        <div className="fv2-flow-other">
          <h3 className="fv2-alt-h">Elsewhere in the document</h3>
          {path.other.map((b) => (
            <BreakRow key={b.id} b={b} />
          ))}
        </div>
      ) : null}
    </>
  );
}
