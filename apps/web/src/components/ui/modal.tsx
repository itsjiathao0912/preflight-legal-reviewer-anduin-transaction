import * as RxDialog from '@radix-ui/react-dialog';
import { useEffect, type ReactNode } from 'react';

/**
 * Radix Dialog for behavior (focus trap, Esc, aria-modal, focus return); app.html `.scrim` / `.modal`
 * styling. While open the app root is made inert.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  testId,
  className = 'modal',
  onOpenAutoFocus,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  testId: string;
  className?: string;
  onOpenAutoFocus?: (e: Event) => void;
  onCloseAutoFocus?: (e: Event) => void;
}) {
  useEffect(() => {
    const app = document.getElementById('app');
    if (!app) return;
    if (open) app.setAttribute('inert', '');
    else app.removeAttribute('inert');
    return () => app.removeAttribute('inert');
  }, [open]);
  return (
    <RxDialog.Root open={open} onOpenChange={onOpenChange}>
      <RxDialog.Portal>
        <RxDialog.Overlay className="scrim">
          <RxDialog.Content
            className={className}
            data-testid={testId}
            aria-describedby={description ? undefined : undefined}
            {...(onOpenAutoFocus ? { onOpenAutoFocus } : {})}
            {...(onCloseAutoFocus ? { onCloseAutoFocus } : {})}
          >
            <div>
              <RxDialog.Title asChild>
                <h2>{title}</h2>
              </RxDialog.Title>
              {description ? (
                <RxDialog.Description asChild>
                  <p className="mq">{description}</p>
                </RxDialog.Description>
              ) : null}
            </div>
            {children}
          </RxDialog.Content>
        </RxDialog.Overlay>
      </RxDialog.Portal>
    </RxDialog.Root>
  );
}
