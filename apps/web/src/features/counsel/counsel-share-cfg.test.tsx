import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePackage } from '../../state/package';
import { useReview, type DocMeta } from '../../state/review';
import { setCounselMode } from '../../state/share-role';
import { DOC_REF_UNAVAILABLE } from '../open-document/doc-ref';
import { forgetDemoPackagesForTest, rememberDemoPackage } from '../open-document/demo-refs';
import { decodePackageConfig } from '../open-document/package-config';
import { FindingsScreen } from '../review/FindingsScreen';
import * as h from '../review/v2/test-helpers';
import { openSharedDocument } from './counsel-boot';
import { captureCounselToken, resumeCounselSession, useShare } from './counsel-share';
import { shareWithCounsel } from './share-flow';
import { getSheet } from '../../api/counselShareApi';

// Counsel share link bug (live 03c768e0): the analyst's package configuration travels in the link
// fragment next to the token; a document that cannot open stays visible as a message on Findings.
const m = vi.hoisted(() => ({ openDocRef: vi.fn(async (..._a: unknown[]) => false) }));

vi.mock('../../api/client', () => ({
  memoryApi: () => ({ ensureRun: async () => ({ run_id: 'r1' }) }),
  isRealMemoryApi: () => true,
}));
vi.mock('../../state/memory-sync', async (orig) => ({
  ...(await orig<typeof import('../../state/memory-sync')>()),
  ensureSession: async () => undefined,
  flushOutbox: async () => undefined,
  outboxDocFor: async () => ({}),
  writesDisabled: () => false,
}));
vi.mock('./export-flow', async (orig) => ({
  ...(await orig<typeof import('./export-flow')>()),
  syncQuestions: async () => 1,
}));
vi.mock('../../api/counselShareApi', async (orig) => ({
  ...(await orig<typeof import('../../api/counselShareApi')>()),
  shareLink: async () => ({ token: 'tok.EN_-1', expires_at: 2_000_000_000_000 }),
  getSheet: vi.fn(() => new Promise(() => undefined)),
}));
vi.mock('../open-document/doc-ref', async (orig) => ({
  ...(await orig<typeof import('../open-document/doc-ref')>()),
  openDocRef: m.openDocRef,
}));
vi.mock('../review/use-review-view', () => ({
  useReviewView: () => ({ rows: [], counts: {}, hasChanges: false, variance: null }),
}));
vi.mock('../review/v2', () => ({ FindingsPanelV2: () => null }));
vi.mock('../review/components/DocPane', () => ({ DocPane: () => null }));
vi.mock('../processing/StageStatus', () => ({ StageStatus: () => null }));
vi.mock('../gate/CoverageLine', () => ({ CoverageLine: () => null }));
vi.mock('../variance/BaselineControl', () => ({ BaselineControl: () => null }));

const H = (c: string) => c.repeat(64);
const PKG_DOC: DocMeta = {
  id: H('a'),
  name: '01-NG3-Subscription-Agreement.docx',
  firmId: 'hartwell-crane',
  firmName: 'Hartwell & Crane',
  fund: 'Northgate Capital Fund III',
  version: 'v1',
  source: 'upload',
  ref: 'up_x',
  packageId: 'pk_1',
};

const ITEM = {
  key: 'f1',
  row: { f: { kind: 'error', issue_class: 'broken_cross_reference' } },
} as never;
const q = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`);
let mounted: { unmount(): void } | null = null;

beforeEach(() => {
  h.installDomStubs();
  document.body.replaceChildren();
  sessionStorage.clear();
  setCounselMode(false);
  forgetDemoPackagesForTest();
  m.openDocRef.mockReset();
  m.openDocRef.mockResolvedValue(false);
  useShare.setState({
    role: 'analyst',
    counselName: null,
    docRef: null,
    docCfg: null,
    openError: null,
    expiresAt: null,
    pendingToken: null,
    pendingCfg: null,
    sheet: null,
    readyAt: null,
    link: null,
  });
  useReview.setState({ doc: null, phase: 'empty', result: null, toast: null } as never);
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  setCounselMode(false);
  usePackage.getState().clear();
});

describe('analyst share link carries the package configuration', () => {
  it('appends &cfg= with every member type and role', async () => {
    rememberDemoPackage('pk_1', 'northgate-iii');
    const doc = (id: string, name: string, type: string, role: string, confidence = 'low') => ({
      id,
      name,
      type,
      role,
      confidence,
      confirmed: true,
      suggestionSource: 'analyst',
      reason: '',
      needsOcr: false,
      format: 'docx',
      titleLines: [],
    });
    usePackage.setState({
      current: {
        id: 'pk_1',
        tag: { firmId: 'hartwell-crane', firmName: 'H', fund: 'F', version: 'v1' },
        docs: [
          doc(H('a'), '01.docx', 'sub_agreement', 'to_digitize'),
          doc(H('b'), '04.docx', 'sub_agreement', 'baseline'),
          doc(H('c'), '05.docx', 'other', 'reference'),
        ],
        primaryDocId: H('a'),
        confirmedTargets: {},
        createdAt: 1,
      } as never,
    });
    const link = await shareWithCounsel({
      doc: PKG_DOC,
      rows: [],
      findings: [],
      memory: null,
      items: [ITEM],
    });
    const mm = /#counsel=tok\.EN_-1&cfg=([A-Za-z0-9_-]+)$/.exec(link.url);
    expect(mm).not.toBeNull();
    expect(decodePackageConfig(mm![1])).toEqual({
      version: 'v1',
      docs: [
        { h: 'a'.repeat(16), t: 'sub_agreement', r: 'to_digitize' },
        { h: 'b'.repeat(16), t: 'sub_agreement', r: 'baseline' },
        { h: 'c'.repeat(16), t: 'other', r: 'reference' },
      ],
    });
  });

  it('a sample link has no cfg', async () => {
    const sample: DocMeta = { ...PKG_DOC, packageId: undefined, source: 'sample', sampleId: '01' };
    const link = await shareWithCounsel({
      doc: sample,
      rows: [],
      findings: [],
      memory: null,
      items: [ITEM],
    });
    expect(link.url).toMatch(/#counsel=tok\.EN_-1$/);
  });
});

describe('counsel keeps the configuration with the session', () => {
  it('captures token + cfg, cleans the URL, keeps cfg on join and after a reload', () => {
    const replaceState = vi.fn();
    expect(
      captureCounselToken(
        { hash: '#counsel=abc.DEF_-1&cfg=eyJ2IjoxfQ', pathname: '/', search: '' },
        { replaceState },
      ),
    ).toBe(true);
    expect(useShare.getState().pendingToken).toBe('abc.DEF_-1');
    expect(useShare.getState().pendingCfg).toBe('eyJ2IjoxfQ');
    expect(replaceState).toHaveBeenCalledWith(null, '', '/#counsel');
    useShare.getState().joined('Anna', Date.now() + 60_000, 'package:northgate-iii');
    expect(useShare.getState().docCfg).toBe('eyJ2IjoxfQ');
    expect(useShare.getState().pendingCfg).toBeNull();
    // reload: a fresh store reads the tab session back
    useShare.setState({ role: 'analyst', docRef: null, docCfg: null });
    expect(resumeCounselSession()).toBe('package:northgate-iii');
    expect(useShare.getState().docCfg).toBe('eyJ2IjoxfQ');
  });

  it('a token-only link still works (no cfg)', () => {
    expect(
      captureCounselToken(
        { hash: '#counsel=abc', pathname: '/', search: '' },
        {
          replaceState: vi.fn(),
        },
      ),
    ).toBe(true);
    expect(useShare.getState().pendingCfg).toBeNull();
    expect(
      captureCounselToken(
        { hash: '#counsel=abc&cfg=<x>', pathname: '/', search: '' },
        {
          replaceState: vi.fn(),
        },
      ),
    ).toBe(false);
  });

  it('passes the decoded cfg to openDocRef', async () => {
    m.openDocRef.mockResolvedValue(true);
    vi.mocked(getSheet).mockRejectedValueOnce(new Error('offline'));
    const cfg = 'eyJ2IjoxLCJkIjpbWyIwMTIzNDU2Nzg5YWJjZGVmIiwibHBhIiwicmVmZXJlbmNlIl1dfQ';
    useShare.setState({ role: 'counsel', docCfg: cfg });
    expect(await openSharedDocument('package:northgate-iii')).toBe(true);
    expect(m.openDocRef).toHaveBeenCalledWith('package:northgate-iii', {
      docs: [{ h: '0123456789abcdef', t: 'lpa', r: 'reference' }],
    });
    expect(useShare.getState().openError).toBeNull();
  });
});

describe('a shared document that cannot open stays visible', () => {
  it('shows DOC_REF_UNAVAILABLE on Findings instead of a blank screen', async () => {
    setCounselMode(true);
    useShare.setState({ role: 'counsel', counselName: 'Anna', docRef: 'package:northgate-iii' });
    expect(await openSharedDocument('package:northgate-iii')).toBe(false);
    expect(useShare.getState().openError).toBe(DOC_REF_UNAVAILABLE);
    mounted = h.renderV2(<FindingsScreen />);
    expect(q('findings-meta')?.textContent).toBe(DOC_REF_UNAVAILABLE);
    expect(q('counsel-doc-unavailable')?.textContent).toContain(DOC_REF_UNAVAILABLE);
    expect(q('counsel-doc-unavailable')?.getAttribute('role')).toBe('alert');
  });

  it('the analyst never sees it', () => {
    useShare.setState({ role: 'analyst', openError: DOC_REF_UNAVAILABLE });
    mounted = h.renderV2(<FindingsScreen />);
    expect(q('findings-meta')?.textContent).toBe('No document open');
    expect(q('counsel-doc-unavailable')).toBeNull();
  });
});
