import 'fake-indexeddb/auto';
import type { DocumentRequest } from '@aduin/core';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReview, type DocMeta } from '../../state/review';
import { setCounselMode } from '../../state/share-role';
import { DEMO_ONLY } from '../counsel/share-flow';
import { useShare } from '../counsel/counsel-share';
import { CounselScreen, requestsMeta } from '../counsel/CounselScreen';
import type { PackageView } from '../package/contract';
import type { Triage } from '../review/model';
import * as h from '../review/v2/test-helpers';
import { SourcesView } from '../review/views/SourcesView';
import type { SourceRow } from '../review/views/sources-model';
import { RequestDrawer } from './RequestDrawer';
import { useRequests } from './request-store';

// Requests (22-10-26): Requests page with three owner rows and the fixed header count, the shared
// Request drawer (tabs + counts, GP documents grouped by kind, Mark as sent), and the Sources
// "GP request" entry point opening the drawer on the GP tab.
const state = vi.hoisted(() => ({
  view: null as unknown,
  pkg: null as unknown,
}));
vi.mock('../review/use-review-view', () => ({ useReviewView: () => state.view }));
vi.mock('../package/package-view', () => ({ usePackageView: () => state.pkg }));
vi.mock('../metrics/MetricsPanel', () => ({ MetricsPanel: () => null }));

const DOC: DocMeta = {
  id: 'd1',
  name: 'Sub Agreement',
  firmId: 'kirkland',
  firmName: 'Kirkland',
  fund: 'Fund III',
  version: 'v1',
  source: 'upload',
  ref: 'up_x',
};

const E1 = h.fv('e1', 'critical', { order: 1 });
const C1 = h.changeFv('c1', { order: 2 });
const TRIAGE: Record<string, Triage> = {
  e1: { status: 'counsel' },
  c1: { status: 'open', ownerAnswers: { gp: null } } as Triage,
};

const req = (over: Partial<DocumentRequest>): DocumentRequest => ({
  id: '0123456789abcdef',
  targetKey: 'annex:f',
  label: 'Annex F',
  targetFamily: 'annex',
  quote: 'p Agreement and the Annex F schedule',
  count: 4,
  firstDocId: 'a'.repeat(64),
  ...over,
});

const q = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const qa = (id: string) => document.body.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`);
const click = (el: HTMLElement | null) => act(() => el!.click());

let mounted: { unmount(): void } | null = null;

beforeEach(() => {
  h.installDomStubs();
  document.body.replaceChildren();
  window.localStorage.clear();
  setCounselMode(false);
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('no network'))),
  );
  useShare.setState({ role: 'analyst', sheet: null, readyAt: null, link: null });
  useRequests.setState({ open: null, focus: null, docKey: null, meta: {} });
  useReview.setState({
    doc: DOC,
    phase: 'ready',
    result: { blocks: [{ id: 'b0', text: 'abc' }], findings: [E1] } as never,
    triage: TRIAGE,
    memory: null,
    selectedId: null,
  });
  state.view = h.makeView([E1], TRIAGE, { changes: [C1] });
  state.pkg = {
    packageId: 'p1',
    firmId: null,
    firmName: '',
    fund: 'Fund III',
    version: 'v1',
    references: [],
    requests: [
      req({}),
      req({ targetKey: 'w9', label: 'Form W-9', targetFamily: 'tax_form', quote: 'Form W-9.' }),
    ],
  } as unknown as PackageView;
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.unstubAllGlobals();
});

function mountAll() {
  mounted = h.renderV2(
    <>
      <CounselScreen />
      <RequestDrawer />
    </>,
  );
}

describe('requests page', () => {
  it('should show three rows and count GP questions and documents in the header', () => {
    mountAll();
    expect(q('counsel-view')?.querySelector('h1')?.textContent).toBe('Requests');
    // counsel 1 open question + GP 1 open question + 2 missing documents
    expect(q('counsel-meta')?.textContent).toBe('3 requests · 4 items waiting');
    expect(qa('requests-list')[0]?.querySelectorAll('li')).toHaveLength(3);
    expect(q('requests-row-counsel')?.tagName).toBe('BUTTON');
    expect(q('requests-row-gp')?.textContent).toContain('0 of 1 answered');
    expect(q('requests-row-gp')?.textContent).toContain('2 documents');
    expect(q('requests-row-gp')?.dataset.status).toBe('draft');
    const fa = q('requests-row-fund_admin');
    expect(fa?.tagName).toBe('DIV');
    expect(fa?.textContent).toContain('Nothing to ask');
    expect(q('questions-filter')).toBeNull();
  });

  it('should open the drawer on the owner tab from a row', () => {
    mountAll();
    click(q('requests-row-gp'));
    expect(q('request-drawer')?.dataset.owner).toBe('gp');
    expect(q('request-tab-gp')?.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement?.id).toBe('rq-title');
  });

  it('should keep the singular header form', () => {
    expect(requestsMeta(1)).toBe('3 requests · 1 item waiting');
  });
});

describe('request drawer', () => {
  it('should show tabs with waiting counts and switch owner', () => {
    useRequests.getState().openDrawer('counsel');
    mountAll();
    expect(q('request-tab-counsel')?.dataset.count).toBe('1');
    expect(q('request-tab-gp')?.dataset.count).toBe('3');
    expect(q('request-tab-fund_admin')?.dataset.count).toBe('0');
    expect(qa('counsel-row')).toHaveLength(1);
    expect(q('counsel-share')).not.toBeNull();
    expect(q('request-mark-sent')).toBeNull();
    click(q('request-tab-fund_admin'));
    expect(q('request-drawer')?.dataset.owner).toBe('fund_admin');
    expect(q('request-no-questions')).not.toBeNull();
    expect((q('request-export') as HTMLButtonElement).disabled).toBe(true);
  });

  it('should keep the Share link disabled reason for an upload', () => {
    useRequests.getState().openDrawer('counsel');
    mountAll();
    const b = q('counsel-share') as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.title).toBe(DEMO_ONLY);
  });

  it('should group the GP documents by kind with one quote and no reference count', () => {
    useRequests.getState().openDrawer('gp');
    mountAll();
    const groups = [...qa('request-doc-group')].map((g) => g.querySelector('h4')?.textContent);
    expect(groups).toEqual(['Annex (1)', 'Tax forms (1)']);
    expect(q('request-doc-quote')?.textContent).toBe('…Agreement and the Annex F schedule');
    expect(q('request-documents')?.textContent).not.toMatch(/referenced/i);
    expect(q('request-status')?.dataset.status).toBe('draft');
  });

  it('should mark the GP request as sent and keep it in this browser', () => {
    useRequests.getState().openDrawer('gp');
    mountAll();
    click(q('request-mark-sent'));
    expect(q('request-status')?.dataset.status).toBe('sent');
    expect(q('request-status')?.textContent).toMatch(/^Round 1 · sent /);
    expect((q('request-mark-sent') as HTMLButtonElement).disabled).toBe(true);
    const stored = JSON.parse(window.localStorage.getItem('requests:v1:d1') ?? '{}') as {
      gp?: { sentAt?: number };
    };
    expect(typeof stored.gp?.sentAt).toBe('number');
  });

  it('should close on Escape and on the close button', () => {
    useRequests.getState().openDrawer('gp');
    mountAll();
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(q('request-drawer')).toBeNull();
    act(() => useRequests.getState().openDrawer('gp'));
    click(document.body.querySelector<HTMLElement>('[data-testid="request-drawer"] .od-x'));
    expect(q('request-drawer')).toBeNull();
  });
});

describe('sources entry point', () => {
  it('should open the drawer on the GP tab from "GP request"', () => {
    const row = {
      key: 'r1',
      targetKey: 'annex:f',
      item: 'Annex F',
      kind: 'Document',
      status: { cls: 'b-fix', icon: 'warn', label: 'Not in package' },
      action: { kind: 'gp' },
      blockId: null,
      quote: '',
    } as unknown as SourceRow;
    mounted = h.renderV2(
      <>
        <SourcesView rows={[row]} pkg={null} />
        <RequestDrawer />
      </>,
    );
    click(q('sources-gp-request'));
    expect(useRequests.getState().open).toBe('gp');
    expect(q('request-drawer')?.dataset.owner).toBe('gp');
  });
});
