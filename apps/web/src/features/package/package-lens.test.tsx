import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { maskQuote, type ExternalReference } from '@aduin/core';
import { usePackage } from '../../state/package';
import { render } from '../../test-utils';
import { tabsFor } from '../structure/model';
import type { PackageDocView, PackageView } from './contract';
import { PackageLens } from './PackageLens';

// Intake Phase 3a: Package lens sections, inline refusal, icon plus word, masked quotes (E13).
const SSN = '123-45-6789';
const RAW = `Investor tax id ${SSN} as set out in the Partnership Agreement`;
const H = (c: string) => c.repeat(64);

function doc(over: Partial<PackageDocView>): PackageDocView {
  return {
    id: H('a'),
    name: 'fund-iii-sub.html',
    type: 'sub_agreement',
    role: 'to_digitize',
    confidence: 'high',
    reason: 'Title says subscription agreement',
    confirmed: true,
    needsOcr: false,
    format: 'html',
    isPrimary: true,
    editable: false,
    ...over,
  };
}

function ref(over: Partial<ExternalReference>): ExternalReference {
  return {
    id: '0'.repeat(16),
    quote: RAW,
    location: { blockIndex: 4, start: 0, end: 10, sectionPath: ['Section 2'] },
    targetLabel: 'Partnership Agreement',
    targetKey: 'lpa',
    targetFamily: 'lpa',
    resolution: 'unclear',
    confirmedByAnalyst: false,
    ...over,
  };
}

const VIEW: PackageView = {
  packageId: 'p1',
  firmId: 'f1',
  firmName: 'Hartwell',
  fund: 'Fund III',
  version: 'v1',
  documents: [
    doc({}),
    doc({
      id: H('b'),
      name: 'lpa-a.pdf',
      type: 'lpa',
      role: 'reference',
      isPrimary: false,
      editable: true,
    }),
    doc({
      id: H('c'),
      name: 'lpa-b.pdf',
      type: 'lpa',
      role: 'reference',
      isPrimary: false,
      editable: true,
    }),
    doc({
      id: H('d'),
      name: 'w9.pdf',
      type: 'tax_form',
      role: 'reference',
      isPrimary: false,
      editable: true,
      confidence: 'low',
    }),
  ],
  references: [
    ref({}),
    ref({
      id: '1'.repeat(16),
      targetKey: 'annex-f',
      targetLabel: 'Annex F',
      targetFamily: 'annex',
      resolution: 'unclear',
    }),
    ref({
      id: '2'.repeat(16),
      targetKey: 'side',
      targetLabel: 'Side Letter',
      targetFamily: 'side_letter',
      resolution: 'not_in_package',
    }),
  ],
  terms: [
    { term: 'Units', status: 'defined_in_package', mentions: 3, definingDocId: H('b'), quote: RAW },
    { term: 'Stock', status: 'unverified', mentions: 1, reason: 'not_in_reference_documents' },
  ],
  coverage: [
    {
      id: 'structure_flow',
      label: 'Structure and flow',
      status: 'full',
      missingTypes: [],
      reasons: [],
    },
    {
      id: 'external_refs',
      label: 'External references',
      status: 'partial',
      missingTypes: ['side_letter'],
      reasons: ['Side letter missing.'],
    },
  ],
  coverageLine: 'Coverage: 1 of 2 check groups full.',
  coverageStatus: 'partial',
  gateReasons: [],
  requests: [],
  baselines: [],
  refreshing: false,
};

const q = (el: HTMLElement, id: string) => [...el.querySelectorAll(`[data-testid="${id}"]`)];

beforeEach(() => usePackage.setState({ current: null }));

describe('package-lens', () => {
  it('renders all sections, groups and the coverage line', () => {
    const el = render(<PackageLens view={VIEW} onShow={() => undefined} />);
    for (const id of [
      'package-lens-documents',
      'package-lens-references',
      'package-lens-terms',
      'package-lens-coverage',
    ])
      expect(q(el, id)).toHaveLength(1);
    expect(q(el, 'package-lens-doc')).toHaveLength(4);
    expect(q(el, 'package-lens-doc-type')).toHaveLength(3);
    expect(q(el, 'package-lens-doc')[0]!.textContent).toContain('Document to digitize');
    expect(q(el, 'package-reference')).toHaveLength(3);
    expect(q(el, 'package-coverage-group').map((g) => g.getAttribute('data-status'))).toEqual([
      'full',
      'partial',
    ]);
    expect(q(el, 'package-lens-coverage')[0]!.textContent).toContain(VIEW.coverageLine);
    const terms = q(el, 'package-term');
    expect(terms[0]!.getAttribute('data-status')).toBe('defined_in_package');
    expect(terms[0]!.textContent).toContain('Defined in LPA');
    expect(terms[1]!.textContent).toContain('Not found in the reference documents');
  });

  it('never relies on colour alone: every status has an icon and a word', () => {
    const el = render(<PackageLens view={VIEW} onShow={() => undefined} />);
    for (const s of el.querySelectorAll('.pkg-lens-st')) {
      expect(s.querySelector('svg')).not.toBeNull();
      expect(s.textContent!.trim().length).toBeGreaterThan(0);
    }
    expect(q(el, 'package-reference')[2]!.textContent).toContain('Not in package');
  });

  it('offers same-family candidates, or all non-primary documents for annexes (E10)', () => {
    const el = render(<PackageLens view={VIEW} onShow={() => undefined} />);
    const [lpa, annex] = q(el, 'package-reference-confirm') as HTMLSelectElement[];
    const opts = (s: HTMLSelectElement) => [...s.options].map((o) => o.textContent);
    expect(opts(lpa!)).toEqual(['Choose a document…', 'lpa-a.pdf', 'lpa-b.pdf', 'None of these']);
    expect(opts(annex!)).toEqual([
      'Choose a document…',
      'lpa-a.pdf',
      'lpa-b.pdf',
      'w9.pdf',
      'None of these',
    ]);
    expect(lpa!.getAttribute('aria-label')).toContain('Partnership Agreement');
  });

  it('shows a refused action inline as plain text', () => {
    const el = render(<PackageLens view={VIEW} onShow={() => undefined} />);
    expect(q(el, 'package-lens-action-error')).toHaveLength(0);
    const sel = q(el, 'package-lens-doc-type')[0] as HTMLSelectElement;
    act(() => {
      sel.value = 'ppm';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const err = q(el, 'package-lens-action-error');
    expect(err).toHaveLength(1);
    expect(err[0]!.textContent).toContain('no longer in the package');
  });

  it('masks reference and definition quotes on screen', () => {
    expect(maskQuote(RAW)).not.toBe(RAW);
    const el = render(<PackageLens view={VIEW} onShow={() => undefined} />);
    expect(el.textContent).toContain(maskQuote(RAW));
    expect(el.textContent).not.toContain(SSN);
  });

  it('names the third tab for the package only when a package view exists', () => {
    expect(tabsFor(false).map((t) => t.label)).toEqual(['Sections', 'Logic', 'Defined terms']);
    expect(tabsFor(true).at(-1)).toEqual({ id: 'terms', label: 'Terms & package' });
    expect(tabsFor(true)).toHaveLength(3);
  });

  it('offers "Open in LPA" for a reference resolved to a whole file', () => {
    const v: PackageView = {
      ...VIEW,
      references: [
        ref({ resolution: 'resolved', resolvedDocId: H('b'), quote: '““Interests” means x.' }),
      ],
    };
    const el = render(<PackageLens view={v} onShow={() => undefined} />);
    const open = q(el, 'package-reference-open');
    expect(open).toHaveLength(1);
    expect(open[0]!.textContent).toBe('Open in LPA →');
    expect(q(el, 'package-reference')[0]!.querySelector('q')!.textContent).toBe(
      'Interests” means x.',
    );
  });
});
