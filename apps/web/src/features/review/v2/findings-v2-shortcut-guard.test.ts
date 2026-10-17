import { afterEach, describe, expect, it } from 'vitest';
import { actionForKey, isEditableTarget, shouldIgnoreKey, type KeyLike } from './shortcut-guard';

// AC-15: shortcut ignore list.
const key = (k: string, extra: Partial<KeyLike> = {}): KeyLike => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  repeat: false,
  target: document.body,
  ...extra,
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('findings-v2-shortcut-guard', () => {
  it('maps J/K/C/X in any case', () => {
    expect(actionForKey(key('j'))).toBe('next');
    expect(actionForKey(key('K'))).toBe('prev');
    expect(actionForKey(key('c'))).toBe('ask-counsel');
    expect(actionForKey(key('X'))).toBe('close-issue');
    expect(actionForKey(key('q'))).toBeNull();
  });

  it('J/K allowed on repeat, C/X not', () => {
    expect(actionForKey(key('j', { repeat: true }))).toBe('next');
    expect(actionForKey(key('k', { repeat: true }))).toBe('prev');
    expect(actionForKey(key('c', { repeat: true }))).toBeNull();
    expect(actionForKey(key('x', { repeat: true }))).toBeNull();
  });

  it('ignores modifiers and IME composition', () => {
    for (const m of ['ctrlKey', 'metaKey', 'altKey'] as const)
      expect(actionForKey(key('j', { [m]: true }))).toBeNull();
    expect(actionForKey(key('j', { isComposing: true }))).toBeNull();
    expect(shouldIgnoreKey(key('j'))).toBe(false);
  });

  it('ignores editable targets', () => {
    for (const tag of ['input', 'textarea', 'select']) {
      const el = document.createElement(tag);
      expect(isEditableTarget(el)).toBe(true);
      expect(actionForKey(key('j', { target: el }))).toBeNull();
    }
    const ce = document.createElement('div');
    ce.setAttribute('contenteditable', 'true');
    expect(isEditableTarget(ce)).toBe(true);
    expect(isEditableTarget(document.createElement('button'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });

  it('ignores keys while a dialog is open', () => {
    const d = document.createElement('div');
    d.setAttribute('role', 'dialog');
    document.body.append(d);
    expect(actionForKey(key('c'))).toBeNull();
    expect(shouldIgnoreKey(key('j'), document)).toBe(true);
  });
});
