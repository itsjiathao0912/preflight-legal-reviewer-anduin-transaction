import { render, screen } from './test-utils';
import { describe, expect, it } from 'vitest';
import { PlaceholderPage } from './pages/placeholder-page';
import { features } from './features/registry';

describe('@aduin/web smoke (jsdom)', () => {
  it('renders the placeholder page', () => {
    render(<PlaceholderPage />);
    expect(screen.getHeading()).toBe('Sub-doc QA');
  });

  it('features registry seam exists and is empty', () => {
    expect(Array.isArray(features)).toBe(true);
    expect(features).toHaveLength(0);
  });
});
