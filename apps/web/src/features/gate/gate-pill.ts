import type { IconName } from '../../icons/sprite';
import { NO_TEXT_MESSAGE } from '../review/model';

/** Sidebar gate pill view (pure). `none` = no document open: neutral, never the green Ready state. */
export type GatePillState = 'none' | 'ready' | 'blocked' | 'unreadable';

export interface GatePillView {
  state: GatePillState;
  className: string;
  icon: IconName;
  label: string;
  title: string;
  body: string;
}

export function gatePillView(
  hasDocument: boolean,
  gate: { status: 'ready' | 'blocked'; reasons: readonly unknown[]; unreadable?: boolean },
): GatePillView {
  if (!hasDocument)
    return {
      state: 'none',
      className: 'gate none',
      icon: 'doc',
      label: 'No document',
      title: 'No document open',
      body: 'Open a document to check whether it can be digitized.',
    };
  if (gate.unreadable)
    return {
      state: 'unreadable',
      className: 'gate',
      icon: 'lock',
      label: 'Not ready · no text',
      title: 'Not ready to digitize',
      body: NO_TEXT_MESSAGE,
    };
  if (gate.status === 'blocked')
    return {
      state: 'blocked',
      className: 'gate',
      icon: 'lock',
      label: `Blocked · ${gate.reasons.length}`,
      title: 'Digitization is blocked',
      body: 'These critical items are not resolved. Select one to go to it.',
    };
  return {
    state: 'ready',
    className: 'gate ready',
    icon: 'unlock',
    label: 'Ready to digitize',
    title: 'All critical items are resolved',
    body: 'Every item that blocks digitization has been dismissed with a reason or answered by counsel.',
  };
}
