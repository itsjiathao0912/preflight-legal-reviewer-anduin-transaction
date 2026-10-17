export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey?: boolean;
  repeat: boolean;
  isComposing?: boolean;
  target: EventTarget | null;
}

export function isEditableTarget(t: EventTarget | null): boolean {
  if (!t || typeof (t as Element).tagName !== 'string') return false;
  const el = t as HTMLElement;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  const attr = el.getAttribute?.('contenteditable');
  return attr !== null && attr !== undefined && attr !== 'false';
}

function currentDoc(doc?: Document): Document | undefined {
  if (doc) return doc;
  return typeof document === 'undefined' ? undefined : document;
}

/** Editable target, ctrl/meta/alt, IME composition, or an open dialog. Repeat is per key. */
export function shouldIgnoreKey(e: KeyLike, doc?: Document): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  if (e.isComposing) return true;
  if (isEditableTarget(e.target)) return true;
  const d = currentDoc(doc);
  return !!d?.querySelector('[role="dialog"]');
}

export type ShortcutAction = 'next' | 'prev' | 'ask-counsel' | 'close-issue';

export function actionForKey(e: KeyLike, doc?: Document): ShortcutAction | null {
  if (shouldIgnoreKey(e, doc)) return null;
  switch (e.key.toLowerCase()) {
    case 'j':
      return 'next';
    case 'k':
      return 'prev';
    case 'c':
      return e.repeat ? null : 'ask-counsel';
    case 'x':
      return e.repeat ? null : 'close-issue';
    default:
      return null;
  }
}
