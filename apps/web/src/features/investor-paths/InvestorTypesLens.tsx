import type { InvestorTypeRow, InvestorView } from '@aduin/core';
import { Fragment } from 'react';
import { Icon } from '../../components/ui/icon';

/**
 * Investor types lens (AC61/AC62, app.html #structure "Investor types"): type list, the ordered
 * path through the document for the selected type, skipped sections, and inline gap rows
 * (PATH-04 peer item, Part C, dead end). "No investor types detected" when the form has none.
 */
type Step =
  | { kind: 'section'; number: string; title: string }
  | { kind: 'skip'; items: Array<{ number: string; title: string }> };

function stepsOf(t: InvestorTypeRow): Step[] {
  const all = [
    ...t.sections.map((s) => ({ ...s, on: true })),
    ...t.skipped.map((s) => ({ ...s, on: false })),
  ].sort(
    (a, b) => parseInt(a.number, 10) - parseInt(b.number, 10) || (a.number < b.number ? -1 : 1),
  );
  const out: Step[] = [];
  for (const s of all) {
    if (s.on) out.push({ kind: 'section', number: s.number, title: s.title });
    else {
      const last = out.at(-1);
      if (last?.kind === 'skip') last.items.push({ number: s.number, title: s.title });
      else out.push({ kind: 'skip', items: [{ number: s.number, title: s.title }] });
    }
  }
  return out;
}

const sectionOf = (where: string) => /^Section (\d{1,2}[A-Z]?)/.exec(where)?.[1] ?? null;

export function InvestorTypesLens({
  view,
  type,
  onType,
  selected,
  onRow,
  onShow,
}: {
  view: InvestorView;
  type: string | null;
  onType: (t: string) => void;
  selected: string | null;
  onRow: (key: string, el: HTMLElement) => void;
  onShow: (blockId: string, findingId: string | null) => void;
}) {
  if (!view.types.length) {
    return (
      <div className="empty2" data-testid="investor-empty-state">
        <p className="ph-t">No investor types detected in this document.</p>
      </div>
    );
  }
  const current = view.types.find((t) => t.type === type) ?? view.types[0]!;
  const steps = stepsOf(current);
  const placed = new Set<string>();
  const gapsAt = (n: string) =>
    current.gaps.filter((g) => {
      if (placed.has(g.id) || sectionOf(g.where) !== n) return false;
      placed.add(g.id);
      return true;
    });
  const gapRow = (g: InvestorTypeRow['gaps'][number]) => (
    <div
      key={g.id}
      className={`prow q2 gaprow${selected === g.id ? ' sel' : ''}`}
      data-testid="investor-gap-row"
      data-k={g.id}
      onClick={(e) => onRow(g.id, e.currentTarget)}
    >
      <Icon name="warn" />
      <div className="lab">
        <b>
          {g.kind === 'peer-item'
            ? `${g.item[0]!.toUpperCase()}${g.item.slice(1)} is missing here`
            : g.kind === 'dead-end'
              ? `No route to the signature: ${g.item}`
              : `${g.item} is not on this path`}
        </b>
        {g.peers.length ? ` — ${g.peers.join(', ')} have it.` : null}
        <small>
          Rule {g.kind === 'peer-item' ? 'PATH-04' : g.kind === 'dead-end' ? 'PATH-02' : 'PATH-03'}{' '}
          · deterministic · {g.where}
        </small>
      </div>
      <button
        type="button"
        className="btn"
        onClick={(e) => {
          e.stopPropagation();
          onShow(g.blockId, g.findingId);
        }}
      >
        <Icon name="doc" />
        Show in document
      </button>
    </div>
  );
  const nApplied = current.sections.length;
  const nQuestions = current.questions.length;
  return (
    <div className="inv">
      <div className="tlist" role="group" aria-label="Investor types">
        {view.types.map((t) => (
          <button
            key={t.type}
            type="button"
            className="tl"
            data-testid="investor-type-row"
            data-type={t.type}
            aria-pressed={t.type === current.type}
            onClick={() => onType(t.type)}
          >
            <span className="tn">{t.label}</span>
            <span className="dim">
              {t.sections.length} of {view.sectionTotal} sections
            </span>
            {t.gaps.length ? (
              <span className="badge b-fix">
                <Icon name="warn" />
                {t.gaps.length} gap{t.gaps.length > 1 ? 's' : ''}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <div>
        <div className="pathhead">
          <h3>{current.label}: path through the document</h3>
          <div className="dim">
            {current.uncertain
              ? 'The route could not be proven (no signature section found); nothing is flagged.'
              : `${nApplied} section${nApplied === 1 ? '' : 's'} and ${nQuestions} listed question${nQuestions === 1 ? '' : 's'} apply.`}
          </div>
        </div>
        <div className="path" data-testid="investor-path">
          {steps.map((s, i) =>
            s.kind === 'skip' ? (
              <div className="skipline" key={`skip-${i}`}>
                <Icon name="skip" />
                Skipped: {s.items.map((x) => `${x.number} ${x.title}`.trim()).join(', ')}
              </div>
            ) : (
              <Fragment key={`s-${s.number}`}>
                <div
                  className={`prow${selected === `ps:${s.number}` ? ' sel' : ''}`}
                  data-testid="investor-path-step"
                  data-section={s.number}
                  data-k={`ps:${s.number}`}
                  onClick={(e) => onRow(`ps:${s.number}`, e.currentTarget)}
                >
                  <button type="button" className="rb">
                    <span className="num">{s.number}</span>
                    <span>{s.title}</span>
                  </button>
                  {current.gaps.some((g) => sectionOf(g.where) === s.number) ? (
                    <span className="badge b-fix">
                      <Icon name="warn" />1 gap
                    </span>
                  ) : null}
                </div>
                {current.questions
                  .filter((q) => q.section === s.number)
                  .map((q, qi) => (
                    <div className="prow q2" key={`q-${s.number}-${qi}`}>
                      <span className="lab">{q.text}</span>
                    </div>
                  ))}
                {gapsAt(s.number).map(gapRow)}
              </Fragment>
            ),
          )}
          {current.gaps.filter((g) => !placed.has(g.id)).map(gapRow)}
        </div>
      </div>
    </div>
  );
}
