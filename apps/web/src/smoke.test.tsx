import { describe, expect, it } from 'vitest';
import { featureFor, features, navModules } from './features/registry';
import { PlaceholderView } from './features/placeholders/PlaceholderView';
import { render, screen } from './test-utils';

describe('@aduin/web smoke (jsdom)', () => {
  it('renders a placeholder route view', () => {
    render(<PlaceholderView route="structure" title="Document map" />);
    expect(screen.getHeading()).toBe('Document map');
  });

  it('registers findings plus the five placeholder routes; last entry per id wins', () => {
    expect(features.map((f) => f.id)).toEqual([
      'findings',
      'counsel',
      'structure',
      'compare',
      'memory',
      'documents',
      // Phase 02 append: the real Structure view (last entry per id wins over the placeholder)
      'structure',
      // Phase 07 append: the real Compare view
      'compare',
      // Phase 08 append: the real Counsel questions view
      'counsel',
      // Phase 08b append: the real Firm memory view
      'memory',
      // Documents append: the real Documents view
      'documents',
      // Document map folded into Findings: the route stays, hidden from the sidebar
      'structure',
    ]);
    expect(featureFor('documents')?.component.name).toBe('DocumentsView');
    expect(featureFor('memory')?.component.name).toBe('MemoryView');
    expect(featureFor('memory')?.label).toBe('Firm memory');
    expect(featureFor('counsel')?.component.name).toBe('CounselScreen');
    // Variance P04 "Questions"; 22-10-26: the counsel route is labelled "Requests" (hash unchanged)
    expect(featureFor('counsel')?.label).toBe('Requests');
    expect(featureFor('compare')?.component.name).toBe('CompareScreen');
    expect(featureFor('compare')?.label).toBe('Compare versions');
    expect(featureFor('structure')?.component.name).toBe('FindingsScreen');
    expect(featureFor('structure')?.hidden).toBe(true);
    expect(navModules().map((m) => m.id)).toEqual([
      'findings',
      'counsel',
      'compare',
      'memory',
      'documents',
    ]);
    expect(navModules().map((m) => m.group)).toEqual(['review', 'review', 'check', 'firm', 'firm']);
    expect(featureFor('findings')?.label).toBe('Findings');
    expect(featureFor('nope')).toBeUndefined();
  });
});
