import { useRef, useState } from 'react';
import { Icon } from '../components/ui/icon';
import { Popover } from '../components/ui/popover';
import { reopenRecent } from '../features/open-document/open-actions';
import { useReview } from '../state/review';
import { isRail, useShell } from '../state/shell';

export function DocSwitcher() {
  const [open, setOpen] = useState(false);
  // Open the dialog only after the popover has fully closed: opening it while the popover layer is
  // still mounted leaves two Radix dismissable layers racing, and the dialog's outside click is lost.
  const openDocAfterClose = useRef(false);
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
        onCloseAutoFocus={(e) => {
          if (!openDocAfterClose.current) return;
          openDocAfterClose.current = false;
          e.preventDefault();
          setOpenDoc(true);
        }}
        trigger={
          <button
            className="docsw"
            type="button"
            data-testid="doc-switcher"
            aria-label={`${[name, firm].filter(Boolean).join(' ')}, switch document`}
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
            openDocAfterClose.current = true;
            setOpen(false);
          }}
        >
          <span>Open another document…</span>
          <Icon name="plus" />
        </button>
      </Popover>
    </div>
  );
}
