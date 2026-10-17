import { useState } from 'react';
import { Icon } from '../components/ui/icon';
import { Popover } from '../components/ui/popover';
import { reopenRecent } from '../features/open-document/open-actions';
import { useReview } from '../state/review';
import { isRail, useShell } from '../state/shell';

export function DocSwitcher() {
  const [open, setOpen] = useState(false);
  const doc = useReview((s) => s.doc);
  const recent = useReview((s) => s.recent);
  const rail = useShell(isRail);
  const setOpenDoc = useShell((s) => s.setOpenDoc);
  const name = doc?.name ?? 'No document';
  const firm = doc ? doc.firmName || 'No firm' : 'Open a document';
  return (
    <div>
      <Popover
        open={open}
        onOpenChange={setOpen}
        label="Switch document"
        className="pop-doc"
        testId="doc-menu"
        side={rail ? 'right' : 'bottom'}
        align="start"
        trigger={
          <button
            className="docsw"
            type="button"
            data-testid="doc-switcher"
            aria-label={`${name} ${firm}, switch document`}
            title={rail ? `Switch document: ${name}` : undefined}
          >
            <Icon name="doc" />
            <span className="dt">
              <span className="dn">{name}</span> <span className="df">{firm}</span>
            </span>
            <Icon name="chevd" />
          </button>
        }
      >
        {recent.map((d) => (
          <button
            key={d.id}
            className="di"
            type="button"
            aria-current={doc?.id === d.id ? 'true' : undefined}
            onClick={() => {
              setOpen(false);
              void reopenRecent(d);
            }}
          >
            <span>
              <b className="dib">{d.name}</b>
              <span className="df">{d.firmName || 'No firm'}</span>
            </span>
            {doc?.id === d.id ? <Icon name="tick" /> : <span />}
          </button>
        ))}
        <button
          className="di more1"
          type="button"
          data-testid="open-another"
          onClick={() => {
            setOpen(false);
            setOpenDoc(true);
          }}
        >
          <span>Open another document…</span>
          <Icon name="plus" />
        </button>
      </Popover>
    </div>
  );
}
