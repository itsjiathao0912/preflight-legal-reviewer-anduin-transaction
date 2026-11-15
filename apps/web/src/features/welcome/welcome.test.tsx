import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setCounselMode } from '../../state/share-role';
import { WEBSITE_URL } from './links';
import { WelcomeScreen } from './WelcomeScreen';
import { WELCOME_SEEN_KEY, shouldShowWelcome } from './welcome-gate';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  setCounselMode(false);
  localStorage.clear();
  document.body.replaceChildren();
});

describe('welcome screen', () => {
  it('renders the texts and Start enters the app and remembers the visit', () => {
    const onEnter = vi.fn();
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    act(() => root.render(<WelcomeScreen onEnter={onEnter} />));
    const text = el.textContent ?? '';
    for (const t of [
      'Anduin Transactions · Legal Reviewer challenge',
      'Preflight',
      'Sub-doc QA before digitization, for Anduin’s Digitization Service Analyst.',
      'Faster review',
      'Safer forms',
      'Fewer rebuilds',
    ])
      expect(text).toContain(t);
    const site = el.querySelector<HTMLAnchorElement>('[data-testid="welcome-website"]');
    expect(site?.getAttribute('href')).toBe(WEBSITE_URL);
    expect(site?.target).toBe('_blank');
    expect(el.querySelector('[data-testid="welcome-slides"]')).not.toBeNull();
    act(() => el.querySelector<HTMLButtonElement>('[data-testid="welcome-start"]')?.click());
    expect(onEnter).toHaveBeenCalledOnce();
    expect(localStorage.getItem(WELCOME_SEEN_KEY)).toBe('1');
    expect(shouldShowWelcome('', '')).toBe(false);
    expect(shouldShowWelcome('', '?welcome=1')).toBe(true);
    act(() => root.unmount());
  });

  it('the close button enters the app and remembers the visit', () => {
    const onEnter = vi.fn();
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    act(() => root.render(<WelcomeScreen onEnter={onEnter} />));
    act(() => el.querySelector<HTMLButtonElement>('[data-testid="welcome-close"]')?.click());
    expect(onEnter).toHaveBeenCalledOnce();
    expect(localStorage.getItem(WELCOME_SEEN_KEY)).toBe('1');
    act(() => root.unmount());
  });

  it('shows on a plain first visit, never in counsel mode or on deep links', () => {
    expect(shouldShowWelcome('', '')).toBe(true);
    expect(shouldShowWelcome('#memory', '')).toBe(false);
    expect(shouldShowWelcome('#counsel=abc', '?welcome=1')).toBe(false);
    setCounselMode(true);
    expect(shouldShowWelcome('', '?welcome=1')).toBe(false);
  });
});
