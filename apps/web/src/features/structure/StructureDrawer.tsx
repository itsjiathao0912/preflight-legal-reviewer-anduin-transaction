import type { StructureView } from '@aduin/core';
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '../../components/ui/icon';
import { CONDITION_KIND, REF_STATUS, TERM_STATUS } from './model';

/** Right-hand row detail drawer (app.html #st-drawer): facts, why, provenance, Show in document. */
interface Detail {
  k: string;
  title: string;
  quoteTitle: boolean;
  body: ReactNode;
  blockId: string | null;
  findingId: string | null;
}

function Facts({ rows }: { rows: Array<[string, ReactNode]> }) {
  const shown = rows.filter(([, v]) => v !== '' && v !== null && v !== undefined);
  return (
    <dl className="facts">
      {shown.map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Prov({ rule }: { rule: string }) {
  return (
    <div className="prov">
      <span>
        <Icon name="rule" />
        Rule {rule} · deterministic
      </span>
      <span>
        <Icon name="check" />
        Same result on every run
      </span>
    </div>
  );
}

function detailOf(v: StructureView, key: string): Detail | null {
  if (key.startsWith('ps:')) {
    const n = key.slice(3);
    const s = v.sections.find((x) => x.depth === 0 && x.number === n);
    if (!s) return null;
    key = s.id;
  }
  const sec = v.sections.find((x) => x.id === key);
  if (sec) {
    return {
      k: sec.depth ? 'Part' : 'Section',
      title: `${sec.number}. ${sec.title}`,
      quoteTitle: false,
      blockId: sec.blockId,
      findingId: null,
      body: (
        <>
          <div className="brow">
            {sec.restart ? (
              <span className="badge b-note">
                <Icon name="undo" />
                Numbering restarts here
              </span>
            ) : null}
            {sec.flags ? (
              <span className="badge b-fix">
                <Icon name="warn" />
                {sec.flags} reference{sec.flags > 1 ? 's' : ''} to check
              </span>
            ) : (
              <span className="badge b-ok">
                <Icon name="check" />
                No flags
              </span>
            )}
          </div>
          <Facts
            rows={[
              ['Numbering', sec.numbering],
              ['Refers to others', `${sec.refsOut}`],
              ['Referred to by', `${sec.refsIn}`],
            ]}
          />
          {sec.restart ? (
            <p className="why">
              Numbering inside this section starts again, so a bare “Part B” or “paragraph 1” can
              mean different things in different sections. References must say which section they
              mean.
            </p>
          ) : null}
          <Prov rule="STRUCT-01" />
        </>
      ),
    };
  }
  const r = v.crossrefs.find((x) => x.id === key);
  if (r) {
    const st = REF_STATUS[r.status];
    return {
      k: 'Cross-reference',
      title: `“${r.text}”`,
      quoteTitle: true,
      blockId: r.blockId,
      findingId: r.findingId,
      body: (
        <>
          <div className="brow">
            <span className={`badge ${st.cls}`}>
              <Icon name={st.icon} />
              {st.label}
            </span>
            {r.findingId ? (
              <span className="tag t-new" data-testid="structure-drawer-finding">
                <Icon name="rule" />
                Linked finding
              </span>
            ) : null}
          </div>
          <blockquote className="ev">
            {r.quote}
            <span className="cite">{r.where}</span>
          </blockquote>
          {r.issue && r.expected ? (
            <div className="ef">
              <div>
                <div className="k">Expected</div>
                <div className="v">{r.expected}</div>
              </div>
              <div>
                <div className="k">Found</div>
                <div className="v">{r.target}</div>
              </div>
            </div>
          ) : null}
          <Facts
            rows={[
              ['Where', r.where],
              ['Points to', r.target],
              ['Status', st.label],
            ]}
          />
          <p className="why">
            {r.status === 'resolved'
              ? 'The target exists and its heading fits the sentence around the reference.'
              : r.status === 'suspicious'
                ? 'The target exists, but its heading does not fit the words around the reference.'
                : 'The cited target does not exist in this document.'}
          </p>
          <Prov rule={r.status === 'suspicious' ? 'XREF-02' : 'XREF-01'} />
        </>
      ),
    };
  }
  const x = v.external.find((e) => e.id === key);
  if (x) {
    return {
      k: 'External citation',
      title: `“${x.text}”`,
      quoteTitle: true,
      blockId: x.blockId,
      findingId: null,
      body: (
        <>
          <div className="brow">
            <span className="badge b-st">
              <Icon name="doc" />
              External, not checked
            </span>
          </div>
          <Facts
            rows={[
              ['Where', x.where],
              ['Source', x.source],
              ['Status', 'Listed, not resolved'],
            ]}
          />
          <p className="why">
            This points to a law, rule or form outside the document. It is not an internal
            reference, so it cannot be broken or swapped.
          </p>
          <Prov rule="XREF-04" />
        </>
      ),
    };
  }
  const c = v.conditions.find((e) => e.id === key);
  if (c) {
    const kind = CONDITION_KIND[c.kind];
    return {
      k: 'Conditional instruction',
      title: `“${c.text}”`,
      quoteTitle: true,
      blockId: c.blockId,
      findingId: c.findingId,
      body: (
        <>
          <div className="brow">
            <span className="badge b-st">
              <Icon name={kind.icon} />
              {kind.label}
            </span>
            {c.issue ? (
              <span className="badge b-fix">
                <Icon name="warn" />
                Target unclear
              </span>
            ) : (
              <span className="badge b-ok">
                <Icon name="check" />
                Target found
              </span>
            )}
          </div>
          <Facts
            rows={[
              ['Where', c.where],
              ['When', `Condition: ${c.condition}`],
              ['Then', c.target],
            ]}
          />
          {c.issue ? (
            <p className="why callout-fix">
              {c.targetFound
                ? 'The jump instructions around this condition make part of the form unreachable or circular.'
                : 'The target of this instruction does not exist in the document.'}
            </p>
          ) : null}
          <Prov
            rule={c.kind === 'role' ? 'COND-02' : c.kind === 'negative' ? 'COND-04' : 'COND-01'}
          />
        </>
      ),
    };
  }
  const o = v.options.find((e) => e.id === key);
  if (o) {
    return {
      k: 'Option group',
      title: o.question,
      quoteTitle: false,
      blockId: o.blockId,
      findingId: o.findingId,
      body: (
        <>
          <div className="brow">
            <span className="badge b-st">
              <Icon name={o.howMany === 'one' ? 'ring' : 'check'} />
              {o.howMany === 'one' ? 'Check one' : 'All that apply'}
            </span>
            {o.cueStated ? (
              <span className="badge b-ok">
                <Icon name="check" />
                Cue printed
              </span>
            ) : (
              <span className="badge b-fix">
                <Icon name="warn" />
                Cue inferred
              </span>
            )}
          </div>
          <Facts
            rows={[
              ['Where', o.where],
              ['Options', o.options.join(' · ')],
              ['How many', o.howMany === 'one' ? 'Exactly one' : 'One or more'],
              ['How we know', o.cueText ? `“${o.cueText}”` : 'No cue printed. Inferred.'],
            ]}
          />
          {!o.cueStated ? (
            <p className="why">
              No exclusivity cue is printed. The digitized form needs a rule here, so confirm it
              with counsel before building.
            </p>
          ) : null}
          <Prov rule="OPT-01" />
        </>
      ),
    };
  }
  const t = v.terms.find((e) => e.id === key);
  if (t) {
    const st = TERM_STATUS[t.status];
    return {
      k: 'Defined term',
      title: `“${t.term}”`,
      quoteTitle: true,
      blockId: t.blockId,
      findingId: t.findingId,
      body: (
        <>
          <div className="brow">
            <span className={`badge ${st.cls}`}>
              <Icon name={st.icon} />
              {st.label}
            </span>
          </div>
          <Facts
            rows={[
              ['Defined at', t.definedAt],
              ['Uses', `${t.uses} use${t.uses === 1 ? '' : 's'}`],
            ]}
          />
          <p className="why">{t.note}</p>
          <Prov rule="TERM-01" />
        </>
      ),
    };
  }
  for (const ty of v.investors.types) {
    const g = ty.gaps.find((e) => e.id === key);
    if (!g) continue;
    return {
      k: `Question for ${ty.label}`,
      title: g.item,
      quoteTitle: false,
      blockId: g.blockId,
      findingId: g.findingId,
      body: (
        <>
          <div className="brow">
            <span className="badge b-fix">
              <Icon name="warn" />
              {g.kind === 'dead-end' ? 'Dead end' : 'Gap: missing here'}
            </span>
          </div>
          <Facts
            rows={[
              ['Investor type', ty.label],
              ['Where', g.where],
              ['Peers that have it', g.peers.join(', ')],
            ]}
          />
          <p className="why">
            {g.kind === 'peer-item'
              ? `${g.peers.join(', ')} carry ${g.item}, but ${ty.label} does not. Either it was left off, or this type is meant to answer differently. Counsel decides.`
              : `The clause “${g.clause}” makes this a gap for ${ty.label}.`}
          </p>
          <Prov
            rule={
              g.kind === 'peer-item' ? 'PATH-04' : g.kind === 'dead-end' ? 'PATH-02' : 'PATH-03'
            }
          />
        </>
      ),
    };
  }
  return null;
}

export function StructureDrawer({
  view,
  rowKey,
  onClose,
  onShow,
}: {
  view: StructureView;
  rowKey: string;
  onClose: () => void;
  onShow: (blockId: string, findingId: string | null) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const d = detailOf(view, rowKey);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [rowKey]);
  if (!d) return null;
  return (
    <aside className="drawer" aria-label="Details" data-testid="structure-drawer">
      <header>
        <div>
          <p className="k0">{d.k}</p>
          <h2 tabIndex={-1} ref={heading} className={d.quoteTitle ? 'dq' : undefined}>
            {d.title}
          </h2>
        </div>
        <button className="ibtn" type="button" aria-label="Close details" onClick={onClose}>
          <Icon name="x" />
        </button>
      </header>
      <div className="drbody">
        {d.body}
        {d.blockId ? (
          <div className="acts">
            <button
              type="button"
              className="btn pri"
              onClick={() => onShow(d.blockId!, d.findingId)}
            >
              <Icon name="doc" />
              Show in document
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
