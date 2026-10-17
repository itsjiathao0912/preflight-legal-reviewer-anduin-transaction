import * as RxPopover from '@radix-ui/react-popover';
import type { ReactElement, ReactNode } from 'react';

/**
 * Radix Popover used for behavior only (focus, Esc, outside click, aria-expanded on the trigger);
 * styling comes from the app.html `.pop` tokens. Content has role="dialog".
 */
export function Popover({
  trigger,
  children,
  open,
  onOpenChange,
  label,
  className,
  testId,
  side = 'bottom',
  align = 'end',
  onCloseAutoFocus,
}: {
  trigger: ReactElement;
  children: ReactNode;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  label: string;
  className: string;
  testId: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  /** Runs once the content has unmounted (Radix FocusScope); preventDefault skips focus return. */
  onCloseAutoFocus?: (e: Event) => void;
}) {
  return (
    <RxPopover.Root open={open} onOpenChange={onOpenChange}>
      <RxPopover.Trigger asChild>{trigger}</RxPopover.Trigger>
      <RxPopover.Portal>
        <RxPopover.Content
          role="dialog"
          aria-label={label}
          className={`pop ${className}`}
          data-testid={testId}
          side={side}
          align={align}
          sideOffset={side === 'right' ? 8 : 6}
          collisionPadding={8}
          {...(onCloseAutoFocus ? { onCloseAutoFocus } : {})}
        >
          {children}
        </RxPopover.Content>
      </RxPopover.Portal>
    </RxPopover.Root>
  );
}
