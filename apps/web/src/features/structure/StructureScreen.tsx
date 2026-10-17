import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import '../../styles/structure.css';
import { Icon } from '../../components/ui/icon';
import { useReview } from '../../state/review';
import { useShell } from '../../state/shell';
import { ExportOutlineButton } from '../outline/ExportOutlineButton';
import { InvestorTypesLens } from '../investor-paths/InvestorTypesLens';
import { PackageLens } from '../package/PackageLens';
import { usePackageView } from '../package/package-view';
import { DEFAULT_LENS, lensesFor, lineFor, PACKAGE_LENS, type StructureLensId } from './model';
import { StructureDrawer } from './StructureDrawer';
import { TableLens } from './StructureLenses';

/**
 * #structure (AC17, app.html "SCREEN: Structure"): six lenses with issue counts, "Issues only" by
 * default, "Show everything" (full lists, external citations, flow list), row detail in a right
 * drawer. Reads the engine's StructureView from the review store (types only from core).
 */
export function StructureScreen() {
  const view = useReview((s) => s.result?.structure);
  const doc = useReview((s) => s.doc);
  const phase = useReview((s) => s.phase);
  const failed = useReview((s) => s.result?.failedStage ?? null);
  const select = useReview((s) => s.select);
  const setRoute = useShell((s) => s.setRoute);
  const pkg = usePackageView();
  const [lens, setLens] = useState<StructureLensId>(DEFAULT_LENS);
  const [all, setAll] = useState(false);
  const [flow, setFlow] = useState(false);
  const [row, setRow] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const docKey = useReview((s) => s.result?.docHash ?? '');

  // a new document resets the selection, the drawer and the investor type
  useEffect(() => {
    setRow(null);
    setType(null);
  }, [docKey]);

  // the Package lens falls back to the default only when the open document has no package
  // (never while a store-initiated re-open runs: the view stays non-null with refreshing)
  useEffect(() => {
    if (lens === PACKAGE_LENS && phase === 'ready' && !pkg) setLens(DEFAULT_LENS);
  }, [lens, phase, pkg]);
  const lenses = lensesFor(!!pkg);

  const closeDrawer = (refocus = false) => {
    setRow(null);
    if (refocus) requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  };

  const openRow = (key: string, el: HTMLElement) => {
    trigger.current = el.querySelector('button') ?? el;
    setRow(key);
  };

  const showInDoc = (blockId: string, findingId: string | null) => {
    setRoute('findings');
    if (findingId) select(findingId);
    requestAnimationFrame(() =>
      document.getElementById(`blk-${blockId}`)?.scrollIntoView({ block: 'center' }),
    );
  };

  const pickLens = (id: StructureLensId) => {
    setLens(id);
    closeDrawer();
    requestAnimationFrame(() => document.getElementById(`st-l-${id}`)?.focus());
  };

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = lenses.findIndex((l) => l.id === lens);
    const n =
      e.key === 'ArrowRight' ? (i + 1) % lenses.length : (i - 1 + lenses.length) % lenses.length;
    pickLens(lenses[n]!.id);
    e.preventDefault();
  };

  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' && row) {
      e.stopPropagation();
      closeDrawer(true);
    }
  };

  const header = (
    <header className="pagehead">
      <div className="tt">
        <h1 id="h-structure" tabIndex={-1}>
          Structure
        </h1>
        <p className="meta" data-testid="structure-meta">
          {view
            ? `${view.badge} to check · ${view.sectionCount} sections, ${view.referenceCount} references`
            : doc
              ? 'No structure for this document'
              : 'No document open'}
        </p>
      </div>
      {view && lens !== PACKAGE_LENS ? (
        <div className="hacts">
          <button
            className="btn"
            type="button"
            data-testid="structure-toggle-everything"
            aria-pressed={all}
            onClick={() => setAll((a) => !a)}
          >
            <Icon name="list" />
            Show everything
          </button>
        </div>
      ) : null}
      {doc ? <ExportOutlineButton /> : null}
    </header>
  );

  if (!view) {
    return (
      <section
        className="view"
        id="v-structure"
        aria-labelledby="h-structure"
        data-testid="structure-view"
      >
        {header}
        <div className="pgbody">
          <div className="empty2" data-testid="structure-empty">
            <p className="ph-t">
              {!doc || phase === 'empty'
                ? 'Open a document to see its sections, references, conditions, option groups, defined terms and investor types.'
                : phase === 'loading'
                  ? 'Reading the document…'
                  : failed
                    ? 'The structure of this document could not be read, so this view is empty.'
                    : 'No structure for this document.'}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const investorType = type ?? view.investors.preselected;
  return (
    <section
      className="view"
      id="v-structure"
      aria-labelledby="h-structure"
      data-testid="structure-view"
      onKeyDown={onKey}
    >
      {header}
      <div className="subbar">
        <div className="seg segx" role="tablist" aria-label="Structure lists" onKeyDown={onTabKey}>
          {lenses.map((l) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              id={`st-l-${l.id}`}
              data-testid={`structure-lens-${l.id}`}
              aria-selected={lens === l.id}
              tabIndex={lens === l.id ? 0 : -1}
              onClick={() => pickLens(l.id)}
            >
              {l.label}
              {l.id === PACKAGE_LENS ? (
                pkg && pkg.coverageStatus !== 'full' ? (
                  <span className="fl" data-testid="structure-package-warn">
                    <Icon name="warn" />
                    <span className="sr"> coverage partial</span>
                  </span>
                ) : null
              ) : view.counts[l.id] ? (
                <span className="fl" data-testid={`structure-issue-count-${l.id}`}>
                  <Icon name="warn" />
                  {view.counts[l.id]}
                  <span className="sr"> to check</span>
                </span>
              ) : null}
            </button>
          ))}
        </div>
        {lens === PACKAGE_LENS ? (
          <p className="mut" role="status" data-testid="package-lens-line">
            {pkg?.coverageLine ?? ''}
          </p>
        ) : (
          <p className="mut" role="status" data-testid="structure-line">
            {lineFor(view, lens, all)}
          </p>
        )}
      </div>
      <div className={`stwrap${row ? ' has-drawer' : ''}`}>
        <div className="pgbody" role="tabpanel" aria-labelledby={`st-l-${lens}`}>
          {lens === 'conditions' && all ? (
            <>
              <div style={{ margin: '0 0 10px' }}>
                <button
                  type="button"
                  className="btn"
                  aria-expanded={flow}
                  aria-controls="st-flow"
                  data-testid="structure-flow-toggle"
                  onClick={() => setFlow((f) => !f)}
                >
                  <Icon name="jump" />
                  {flow ? 'Hide' : 'Show'} flow diagram
                </button>
              </div>
              <div className="flowbox" id="st-flow" hidden={!flow}>
                <ol className="mut" style={{ margin: 0, paddingLeft: 20 }}>
                  {view.sections
                    .filter((s) => s.depth === 0)
                    .map((s) => (
                      <li key={s.id}>
                        {s.number}. {s.title}
                        {view.conditions
                          .filter((c) => c.where === `Section ${s.number}`)
                          .map((c) => (
                            <div key={c.id} className="dim">
                              Only when “{c.condition}”: {c.target}
                            </div>
                          ))}
                      </li>
                    ))}
                </ol>
              </div>
            </>
          ) : null}
          {lens === PACKAGE_LENS ? (
            pkg ? (
              <PackageLens view={pkg} onShow={(blockId) => showInDoc(blockId, null)} />
            ) : null
          ) : lens === 'investors' ? (
            <InvestorTypesLens
              view={view.investors}
              type={investorType}
              onType={(t) => {
                setType(t);
                closeDrawer();
              }}
              selected={row}
              onRow={openRow}
              onShow={showInDoc}
            />
          ) : (
            <TableLens v={view} lens={lens} all={all} selected={row} onRow={openRow} />
          )}
        </div>
        {row ? (
          <StructureDrawer
            view={view}
            rowKey={row}
            onClose={() => closeDrawer(true)}
            onShow={showInDoc}
          />
        ) : null}
      </div>
    </section>
  );
}
