import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ExternalReference } from '@aduin/core';
import { usePackage } from '../../state/package';
import { useRefView } from '../../state/ref-view';
import { render } from '../../test-utils';
import type { PackageDocView, PackageView } from './contract';
import { PackageReferences } from './PackageReferences';
import { definitionLocationText, PackageTerms } from './PackageTerms';
import { NO_DEFINITION_FILE, sourceFilesFor } from './source-files';

// Source File traceability: definition location + Open button, cited part of an external
// reference, and the Findings Details "Source File" row visibility rules.
const H = (c: string) => c.repeat(64);
const SUB = H('a');
const LPA = H('b');

function doc(over: Partial<PackageDocView>): PackageDocView {
  return {
    id: SUB,
    name: '01-NG3-Subscription-Agreement.docx',
    type: 'sub_agreement',
    role: 'to_digitize',
    confidence: 'high',
    reason: '',
    confirmed: true,
    needsOcr: false,
    format: 'docx',
    isPrimary: true,
    editable: false,
    ...over,
  };
}

const LPA_DOC = doc({
  id: LPA,
  name: '02-NG3-LPA-Definitions-and-Key-Terms.docx',
  type: 'lpa',
  role: 'reference',
  isPrimary: false,
  editable: true,
});

function ref(over: Partial<ExternalReference>): ExternalReference {
  return {
    id: '0'.repeat(16),
    quote: 'as set out in Section 3.2 of the Partnership Agreement',
    location: { blockIndex: 4, start: 33, end: 54, sectionPath: ['Section 2'] },
    targetLabel: 'Partnership Agreement',
    targetKey: 'lpa',
    targetFamily: 'lpa',
    resolution: 'resolved',
    resolvedDocId: LPA,
    confirmedByAnalyst: false,
    ...over,
  };
}

function view(over: Partial<PackageView> = {}): PackageView {
  return {
    packageId: 'p1',
    firmId: 'f1',
    firmName: 'Northgate',
    fund: 'Fund III',
    version: 'v1',
    documents: [doc({}), LPA_DOC],
    references: [],
    terms: [],
    coverage: [],
    coverageLine: '',
    coverageStatus: 'full',
    gateReasons: [],
    requests: [],
    baselines: [],
    refreshing: false,
    ...over,
  };
}

const q = (el: HTMLElement, id: string) => [...el.querySelectorAll(`[data-testid="${id}"]`)];

const finding = (issue_class: string, blockId = 'b4', start = 30, end = 60, used?: string) => ({
  issue_class: issue_class as never,
  anchor: { docHash: SUB, blockId, offsetStart: start, offsetEnd: end },
  detail: { facts: used ? { used_term: used } : {} },
});

beforeEach(() => {
  usePackage.setState({ current: null });
  useRefView.setState({ target: null, status: 'idle', blocks: [], seq: 0 });
});

describe('source-file: terms location', () => {
  it('should show "Defined in LPA · Section 1.1, ¶ 4" and an Open in LPA button', () => {
    const v = view({
      terms: [
        {
          term: 'Capital Commitment',
          status: 'defined_in_package',
          mentions: 3,
          definingDocId: LPA,
          quote: '“Capital Commitment” means the amount.',
          definitionLocation: { blockIndex: 9, sectionPath: [], sectionLabel: '1.1', paragraph: 4 },
        },
      ],
    });
    const el = render(<PackageTerms view={v} />);
    expect(q(el, 'package-term-status')[0]!.textContent).toContain(
      'Defined in LPA · Section 1.1, ¶ 4',
    );
    const open = q(el, 'package-term-open')[0] as HTMLButtonElement;
    expect(open.textContent).toBe('Open in LPA →');
    act(() => open.click());
    expect(useRefView.getState().target).toMatchObject({
      docId: LPA,
      label: 'LPA',
      blockIndex: 9,
      backLabel: 'Subscription Agreement',
    });
  });

  it('should keep "Defined in LPA" without a location when none is known (old facts)', () => {
    const v = view({
      terms: [{ term: 'Units', status: 'defined_in_package', mentions: 1, definingDocId: LPA }],
    });
    const el = render(<PackageTerms view={v} />);
    expect(q(el, 'package-term-status')[0]!.textContent).toMatch(/Defined in LPA$/);
    expect(q(el, 'package-term-open')).toHaveLength(1);
  });

  it('should fall back to the block paragraph when no numbered part holds the definition', () => {
    expect(definitionLocationText({ blockIndex: 11, sectionPath: ['Article I'] })).toBe(
      'Article I, ¶ 12',
    );
  });
});

describe('source-file: external reference part', () => {
  it('should show "Resolved to LPA · Section 3.2 (Permitted Uses)" plus Open in LPA', () => {
    const v = view({
      references: [
        ref({ resolvedPart: { label: '3.2', title: 'Permitted Uses', blockIndex: 40 } }),
      ],
    });
    const el = render(<PackageReferences view={v} onShow={() => undefined} />);
    expect(q(el, 'package-reference')[0]!.textContent).toContain(
      'Resolved to LPA · Section 3.2 (Permitted Uses)',
    );
    const open = q(el, 'package-reference-open')[0] as HTMLButtonElement;
    expect(open.textContent).toBe('Open in LPA →');
    act(() => open.click());
    expect(useRefView.getState().target?.blockIndex).toBe(40);
  });

  it('should keep the whole-file "Resolved to <file>" when the part was not found', () => {
    const el = render(
      <PackageReferences view={view({ references: [ref({})] })} onShow={() => undefined} />,
    );
    expect(q(el, 'package-reference')[0]!.textContent).toContain(`Resolved to ${LPA_DOC.name}`);
    expect(q(el, 'package-reference-open')).toHaveLength(0);
  });
});

describe('source-file: Details row visibility', () => {
  it('should list the LPA for a defined-term check', () => {
    const s = sourceFilesFor(finding('defined_term_issue'), view(), 4);
    expect(s?.files.map((e) => e.doc.id)).toEqual([LPA]);
    expect(s?.missing).toEqual([]);
  });

  it('should open the term definition block when the term is listed', () => {
    const v = view({
      terms: [
        {
          term: 'Units',
          status: 'defined_in_package',
          mentions: 1,
          definingDocId: LPA,
          definitionLocation: { blockIndex: 7, sectionPath: [] },
        },
      ],
    });
    const s = sourceFilesFor(finding('defined_term_issue', 'b4', 0, 1, 'Units'), v, 4);
    expect(s?.files[0]?.blockIndex).toBe(7);
  });

  it('should say "none in the package (no LPA), terms not checked" when there is no LPA', () => {
    const s = sourceFilesFor(finding('defined_term_issue'), view({ documents: [doc({})] }), 4);
    expect(s).toEqual({ files: [], missing: [NO_DEFINITION_FILE] });
  });

  it('should list the resolved file for a finding over an external reference', () => {
    const v = view({ references: [ref({})] });
    expect(sourceFilesFor(finding('broken_cross_reference'), v, 4)?.files[0]?.doc.id).toBe(LPA);
    // same block, no overlap -> no row
    expect(sourceFilesFor(finding('broken_cross_reference', 'b4', 0, 5), v, 4)).toBeNull();
  });

  it('should name a missing reference target as not in the package', () => {
    const v = view({
      references: [
        ref({ targetLabel: 'Annex F', resolution: 'not_in_package', resolvedDocId: undefined }),
      ],
    });
    expect(sourceFilesFor(finding('broken_conditional'), v, 4)?.missing).toEqual([
      'none in the package (no Annex F), reference not checked',
    ]);
  });

  it('should show no row for checks that use no other file, or without a package', () => {
    expect(sourceFilesFor(finding('placeholder'), view(), 4)).toBeNull();
    expect(sourceFilesFor(finding('defined_term_issue'), null, 4)).toBeNull();
  });
});
