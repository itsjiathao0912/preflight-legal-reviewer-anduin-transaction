import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '../../../components/ui/icon';
import { Popover } from '../../../components/ui/popover';

export interface FlowTypeOption {
  id: string;
  label: string;
  stuck: boolean;
  /** "Stuck at Section N" / "Stuck before the signature"; null when the type reaches it. */
  note: string | null;
}

const StatusIcon = ({ stuck }: { stuck: boolean }) => (
  <span style={{ color: stuck ? 'var(--block-fg)' : 'var(--ok-fg)', display: 'inline-flex' }}>
    <Icon name={stuck ? 'stop' : 'check'} />
  </span>
);

/** Investor type picker for Form flow: a light listbox in a Radix popover (no OS menu). */
export function FlowTypePicker({
  options,
  value,
  onChange,
}: {
  options: FlowTypeOption[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const items = useRef<(HTMLLIElement | null)[]>([]);
  const current = options.find((o) => o.id === value) ?? options[0];
  useEffect(() => {
    if (open) items.current[active]?.focus();
  }, [open, active]);
  const move = (i: number) => {
    const n = (i + options.length) % options.length;
    setActive(n);
  };
  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') move(active + 1);
    else if (e.key === 'ArrowUp') move(active - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(options.length - 1);
    else if (e.key === 'Enter' || e.key === ' ') {
      const o = options[active];
      if (o) pick(o.id);
    } else return;
    e.preventDefault();
  };
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setActive(Math.max(0, options.findIndex((x) => x.id === current?.id)));
      }}
      label="Investor type"
      className="fv2-flow-menu"
      testId="flow-type-menu"
      align="start"
      trigger={
        <button
          type="button"
          className="btn sm fv2-flow-trig"
          data-testid="flow-type-select"
          data-value={current?.id ?? ''}
          data-stuck={current?.stuck ? 'true' : undefined}
          aria-haspopup="listbox"
          aria-label={`Investor type: ${current?.label ?? 'none'}${current?.stuck ? ', stuck' : ''}`}
        >
          {current ? <StatusIcon stuck={current.stuck} /> : null}
          {current?.label}
          <Icon name="chevd" />
        </button>
      }
    >
      <ul
        role="listbox"
        aria-label="Investor type"
        className="fv2-flow-list"
        onKeyDown={onKey}
      >
        {options.map((o, i) => {
          const sel = o.id === current?.id;
          return (
            <li
              key={o.id}
              ref={(el) => {
                items.current[i] = el;
              }}
              role="option"
              aria-selected={sel}
              tabIndex={i === active ? 0 : -1}
              className="fv2-flow-opt"
              data-testid={`flow-type-${o.id}`}
              onClick={() => pick(o.id)}
              onMouseEnter={() => setActive(i)}
            >
              <StatusIcon stuck={o.stuck} />
              <span className="fv2-flow-opt-t">
                {o.label}
                {o.note ? <span className="fv2-flow-opt-n">{o.note}</span> : null}
              </span>
              {sel ? <Icon name="check" /> : <span />}
            </li>
          );
        })}
      </ul>
    </Popover>
  );
}
