import { maskQuote, type DocumentRequest } from '@aduin/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PackageView } from '../package/contract';
import { render } from '../../test-utils';
import { GpRequestGroup } from './GpRequestGroup';

// Intake Phase 3c (AC-I20, E13): GP group items, counts, none-state, absence without a package,
// and on-screen masking of the (unmasked in core) quote.
let current: PackageView | null = null;
vi.mock('../package/package-view', () => ({ usePackageView: () => current }));

const RAW = 'Wire funds to routing number 021000021 per Annex F.';
const req = (over: Partial<DocumentRequest>): DocumentRequest => ({
  id: '0123456789abcdef',
  targetKey: 'annex:f',
  label: 'Annex F',
  targetFamily: 'annex',
  quote: RAW,
  count: 2,
  firstDocId: 'a'.repeat(64),
  ...over,
});
const view = (requests: DocumentRequest[]): PackageView =>
  ({
    packageId: 'p1',
    firmId: null,
    firmName: '',
    fund: 'Fund III',
    version: 'v1',
    requests,
  }) as unknown as PackageView;

beforeEach(() => {
  document.body.replaceChildren();
  current = null;
});

describe('gp-request-group', () => {
  it('should render nothing without a package', () => {
    const c = render(<GpRequestGroup />);
    expect(c.querySelector('[data-testid="gp-group"]')).toBeNull();
  });

  it('should list one item per request with count and masked quote', () => {
    expect(maskQuote(RAW)).not.toBe(RAW);
    current = view([
      req({}),
      req({ targetKey: 'side_letter:x', label: 'Side Letter', quote: 'any Side Letter', count: 1 }),
    ]);
    const c = render(<GpRequestGroup />);
    const items = c.querySelectorAll('[data-testid="gp-request-item"]');
    expect(items).toHaveLength(2);
    expect(items[0]?.getAttribute('data-target-key')).toBe('annex:f');
    const counts = [...c.querySelectorAll('[data-testid="gp-request-count"]')].map(
      (e) => e.textContent,
    );
    expect(counts).toEqual(['referenced 2 times', 'referenced 1 time']);
    const q = c.querySelector('[data-testid="gp-request-quote"]')?.textContent;
    expect(q).toBe(maskQuote(RAW));
    expect(c.textContent).not.toContain(RAW);
    expect(c.textContent).not.toContain('021000021');
    expect(c.querySelector('[data-testid="gp-request-export"]')).not.toBeNull();
    expect(c.querySelector('[data-testid="gp-request-none"]')).toBeNull();
  });

  it('should show the none state for a package without missing documents', () => {
    current = view([]);
    const c = render(<GpRequestGroup />);
    expect(c.querySelector('[data-testid="gp-group"]')).not.toBeNull();
    expect(c.querySelector('[data-testid="gp-request-none"]')).not.toBeNull();
    expect(c.querySelectorAll('[data-testid="gp-request-item"]')).toHaveLength(0);
  });
});
