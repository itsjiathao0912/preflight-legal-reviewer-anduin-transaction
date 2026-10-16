import type { LensId, StructureView } from '@aduin/core';
import type { ReactNode } from 'react';
import { Icon } from '../../components/ui/icon';
import type { IconName } from '../../icons/sprite';
import { CONDITION_KIND, REF_STATUS, TERM_STATUS } from './model';

/** Table lenses of the #structure view (app.html secTable / refTable / condTable / optTable / termTable). */
type RowHandler = (key: string, el: HTMLElement) => void;

function Badge({ cls, icon, children }: { cls: string; icon: IconName; children: ReactNode }) {
  return (
    <span className={`badge ${cls}`}>
      <Icon name={icon} />
      {children}
    </span>
  );
}

function Table({
  caption,
  head,
  children,
}: {
  caption: string;
  head: string[];
  children: ReactNode;
}) {
  return (
    <div className="twrap">
      <table className="t">
        <caption className="sr">{caption}</caption>
        <thead>
          <tr>
            {head.map((h) => (
              <th scope="col" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Row({
  k,
  selected,
  onRow,
  children,
}: {
  k: string;
  selected: string | null;
  onRow: RowHandler;
  children: ReactNode;
}) {
  return (
    <tr
      data-k={k}
      data-testid="structure-row"
      className={selected === k ? 'sel' : undefined}
      onClick={(e) => onRow(k, e.currentTarget)}
    >
      {children}
    </tr>
  );
}

function Empty() {
  return (
    <div className="empty2" data-testid="structure-empty-lens">
      <p className="ph-t">
        Nothing to check in this list. Turn on Show everything for the full list.
      </p>
    </div>
  );
}

export function TableLens({
  v,
  lens,
  all,
  selected,
  onRow,
}: {
  v: StructureView;
  lens: Exclude<LensId, 'investors'>;
  all: boolean;
  selected: string | null;
  onRow: RowHandler;
}) {
  const props = { selected, onRow };
  if (lens === 'sections') {
    const rows = all ? v.sections : v.sections.filter((s) => s.depth === 0 && s.flags > 0);
    if (!rows.length) return <Empty />;
    return (
      <Table caption="Sections" head={['Section', 'Numbering', 'References', 'Flags']}>
        {rows.map((s) => (
          <Row key={s.id} k={s.id} {...props}>
            <td>
              <button type="button" className="rb" style={{ paddingLeft: s.depth * 22 }}>
                <span className="num">{s.number}</span>
                <span>{s.title}</span>
              </button>
            </td>
            <td>
              {s.restart ? (
                <>
                  <Badge cls="b-note" icon="undo">
                    Restarts
                  </Badge>{' '}
                </>
              ) : null}
              <span className="dim">{s.numbering}</span>
            </td>
            <td className="dim">
              {s.refsIn} in · {s.refsOut} out
            </td>
            <td>
              {s.flags ? (
                <Badge cls="b-fix" icon="warn">
                  {s.flags} to check
                </Badge>
              ) : (
                <span className="dim">None</span>
              )}
            </td>
          </Row>
        ))}
      </Table>
    );
  }
  if (lens === 'crossrefs') {
    const rows = all ? v.crossrefs : v.crossrefs.filter((r) => r.issue);
    return (
      <>
        {rows.length ? (
          <Table
            caption="Cross-references"
            head={['Reference text', 'Where it is', 'Points to', 'Status']}
          >
            {rows.map((r) => {
              const st = REF_STATUS[r.status];
              return (
                <Row key={r.id} k={r.id} {...props}>
                  <td>
                    <button type="button" className="rb dq">
                      {r.text}
                    </button>
                  </td>
                  <td className="dim">{r.where}</td>
                  <td>{r.target}</td>
                  <td>
                    <Badge cls={st.cls} icon={st.icon}>
                      {st.label}
                    </Badge>
                  </td>
                </Row>
              );
            })}
          </Table>
        ) : (
          <Empty />
        )}
        {all ? (
          <div data-testid="structure-external">
            <div className="sechead">
              <h3>External, not checked</h3>
              <span className="dim">{v.external.length} citations</span>
            </div>
            <Table
              caption="External citations"
              head={['Citation', 'Where it is', 'Source', 'Status']}
            >
              {v.external.map((x) => (
                <Row key={x.id} k={x.id} {...props}>
                  <td>
                    <button type="button" className="rb dq">
                      {x.text}
                    </button>
                  </td>
                  <td className="dim">{x.where}</td>
                  <td>{x.source}</td>
                  <td>
                    <Badge cls="b-st" icon="doc">
                      External, not checked
                    </Badge>
                  </td>
                </Row>
              ))}
            </Table>
          </div>
        ) : null}
      </>
    );
  }
  if (lens === 'conditions') {
    const rows = all ? v.conditions : v.conditions.filter((c) => c.issue);
    if (!rows.length) return <Empty />;
    return (
      <Table
        caption="Conditional instructions"
        head={['Type', 'Instruction', 'Condition', 'Target']}
      >
        {rows.map((c) => {
          const k = CONDITION_KIND[c.kind];
          return (
            <Row key={c.id} k={c.id} {...props}>
              <td>
                <Badge cls="b-st" icon={k.icon}>
                  {k.label}
                </Badge>
              </td>
              <td>
                <button type="button" className="rb dq">
                  “{c.text}”
                </button>
                <div className="dim">{c.where}</div>
              </td>
              <td>{c.condition}</td>
              <td>
                {c.target}
                <div style={{ marginTop: 4 }}>
                  {c.targetFound && !c.issue ? (
                    <Badge cls="b-ok" icon="check">
                      Target found
                    </Badge>
                  ) : (
                    <Badge cls="b-fix" icon="warn">
                      Target unclear
                    </Badge>
                  )}
                </div>
              </td>
            </Row>
          );
        })}
      </Table>
    );
  }
  if (lens === 'options') {
    const rows = all ? v.options : v.options.filter((o) => o.issue);
    if (!rows.length) return <Empty />;
    return (
      <Table caption="Option groups" head={['Question', 'Where', 'Options', 'How many']}>
        {rows.map((o) => (
          <Row key={o.id} k={o.id} {...props}>
            <td>
              <button type="button" className="rb">
                {o.question}
              </button>
            </td>
            <td className="dim">{o.where}</td>
            <td>{o.options.join(' · ')}</td>
            <td>
              <Badge cls="b-st" icon={o.howMany === 'one' ? 'ring' : 'check'}>
                {o.howMany === 'one' ? 'Check one' : 'All that apply'}
              </Badge>
              <div style={{ marginTop: 4 }}>
                {o.cueStated ? (
                  <span className="dim">Cue printed</span>
                ) : (
                  <Badge cls="b-fix" icon="warn">
                    Cue inferred
                  </Badge>
                )}
              </div>
            </td>
          </Row>
        ))}
      </Table>
    );
  }
  const rows = all ? v.terms : v.terms.filter((t) => t.issue);
  if (!rows.length) return <Empty />;
  return (
    <Table caption="Defined terms" head={['Term', 'Defined at', 'Uses', 'Status']}>
      {rows.map((t) => {
        const st = TERM_STATUS[t.status];
        return (
          <Row key={t.id} k={t.id} {...props}>
            <td>
              <button type="button" className="rb dq">
                {t.term}
              </button>
            </td>
            <td className="dim">{t.definedAt}</td>
            <td>{t.uses}</td>
            <td>
              <Badge cls={st.cls} icon={st.icon}>
                {st.label}
              </Badge>
            </td>
          </Row>
        );
      })}
    </Table>
  );
}
