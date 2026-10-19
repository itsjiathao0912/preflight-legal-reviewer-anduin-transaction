import 'fake-indexeddb/auto';
import { type ActiveDecision, type CounselSheetResponse } from '@aduin/core';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryApi } from '../../api/client';
import { ensureSession, outbox, writesDisabled } from '../../state/memory-sync';
import { useReview, type DocMeta } from '../../state/review';
import { isCounselMode, setCounselMode } from '../../state/share-role';
import {
  docRefOf,
  forgetDemoPackagesForTest,
  rememberDemoPackage,
} from '../open-document/demo-refs';
import { FindingsPanelV2 } from '../review/v2/FindingsPanelV2';
import * as h from '../review/v2/test-helpers';
import { CounselScreen } from './CounselScreen';
import { getSheet, setCounselShareFetch } from '../../api/counselShareApi';
import { captureCounselToken, refreshSheet, remoteAnswers, useShare } from './counsel-share';
import { DEMO_ONLY, ShareError, shareWithCounsel } from './share-flow';

// counsel-share-link plan v2, gate `counsel-share-mode`: counsel sees the SAME Findings panel with
// analyst actions hidden, answers + comments per finding, an in-memory overlay of the shared state,
// no memory session / write in counsel mode, Share only for bundled demo documents, Mark ready only
// when the gate is green.
const state = vi.hoisted(() => ({ reasons: [] as unknown[] }));

vi.mock('../review/use-review-view', () => ({
  useReviewView: () => ({
    rows: [],
    gate: { status: state.reasons.length ? 'blocked' : 'ready', reasons: state.reasons },
    counts: { owners: { counsel: 0, gp: 0, fund_admin: 0 } },
    hasChanges: false,
    regressionMeta: {},
  }),
}));
vi.mock('../metrics/MetricsPanel', () => ({ MetricsPanel: () => null }));
vi.mock('./GpRequestGroup', () => ({ GpRequestGroup: () => null }));
vi.mock('../../api/counselShareApi', async (orig) => ({
  ...(await orig<typeof import('../../api/counselShareApi')>()),
  getSheet: vi.fn(() => new Promise(() => undefined)),
}));

const FP = 'a'.repeat(64);
const SHEET: CounselSheetResponse = {
  role: 'counsel',
  doc_ref: 'package:northgate-iii',
  questions: [
    {
      id: 'q1',
      finding_id: 'e1',
      finding_key: 'e1',
      fingerprint: FP,
      issue_class: 'broken_cross_reference',
      severity: 'critical',
      location: 'Section 6',
      quote_masked: 'Custodian details go in Part B.',
      status: 'exported',
      interpretations: ['Part B of Section 6', 'Part B of Annex 1'],
      created_at: 1,
    },
  ],
  answers: [],
  comments: [
    {
      id: 'c1',
      question_id: 'q1',
      author_role: 'analyst',
      author_name: 'Linh Tran',
      body: 'Please check Part B.',
      created_at: 5,
    },
  ],
  decisions: [],
  ready_at: null,
};

const DOC: DocMeta = {
  id: 'd1',
  name: 'Doc',
  firmId: 'kirkland',
  firmName: 'Kirkland',
  fund: 'Fund III',
  version: 'v1',
  source: 'sample',
  sampleId: '01',
  ref: '01.html',
};
const UPLOAD: DocMeta = { ...DOC, source: 'upload', sampleId: undefined, ref: 'up_x' } as DocMeta;

const E1 = h.fv('e1', 'critical', { order: 1 });
const E2 = h.fv('e2', 'high', { order: 2 });

const q = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const qa = (id: string) => document.body.querySelectorAll(`[data-testid="${id}"]`);

let mounted: { unmount(): void } | null = null;
let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  h.installDomStubs();
  document.body.replaceChildren();
  state.reasons = [];
  setCounselMode(false);
  forgetDemoPackagesForTest();
  fetchSpy = vi.fn(() => Promise.reject(new Error('no network in unit tests')));
  vi.stubGlobal('fetch', fetchSpy);
  useShare.setState({
    role: 'analyst',
    counselName: null,
    docRef: null,
    expiresAt: null,
    pendingToken: null,
    sheet: null,
    readyAt: null,
    link: null,
  });
  useReview.setState({
    doc: DOC,
    phase: 'ready',
    result: { blocks: [{ id: 'b0', text: 'abc' }], findings: [E1, E2] } as never,
    triage: {},
    memory: null,
    selectedId: null,
  });
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  setCounselMode(false);
  vi.unstubAllGlobals();
});

function mountPanel() {
  const view = h.makeView([E1, E2], useReview.getState().triage);
  mounted = h.renderV2(
    <div className="work">
      <FindingsPanelV2 view={view} />
    </div>,
  );
}

function enterCounsel() {
  setCounselMode(true);
  useShare.setState({ role: 'counsel', counselName: 'Anna Counsel', sheet: SHEET });
}

describe('counsel-share-mode: Findings panel in counsel mode', () => {
  it('should hide the analyst action bar and show answer + comments for a shared finding', () => {
    enterCounsel();
    useReview.setState({ selectedId: 'e1' });
    mountPanel();
    expect(q('action-bar')).toBeNull();
    expect(q('action-counsel')).toBeNull();
    expect(q('action-dismiss')).toBeNull();
    const block = q('finding-counsel-block');
    expect(block?.getAttribute('data-question-id')).toBe('q1');
    expect(qa('counsel-comment')).toHaveLength(1);
    expect(q('counsel-comment-input')).not.toBeNull();
    act(() => q('counsel-record')!.click());
    // counsel answers under the joined name: A/B readings, a note, no who/date fields
    expect(q('answer-as')?.textContent).toContain('Anna Counsel');
    expect(q('answer-by')).toBeNull();
  });

  it('should show "Not sent to counsel" for a finding without a question', () => {
    enterCounsel();
    useReview.setState({ selectedId: 'e2' });
    mountPanel();
    expect(q('counsel-not-sent')?.textContent).toBe('Not sent to counsel');
    expect(q('finding-counsel-block')).toBeNull();
    expect(q('counsel-comment-input')).toBeNull();
  });

  it('should keep the analyst bar and show the shared thread to the analyst', () => {
    useShare.setState({ sheet: { ...SHEET, role: 'analyst' } });
    useReview.setState({ selectedId: 'e1' });
    mountPanel();
    expect(q('action-bar')).not.toBeNull();
    expect(q('finding-counsel-block')).not.toBeNull();
    // the analyst never records counsel's answer from the shared block
    expect(q('counsel-record')).toBeNull();
  });
});

describe('counsel-share-mode: no memory session or write in counsel mode', () => {
  it('should never mint a session, look up memory or queue writes', async () => {
    enterCounsel();
    expect(isCounselMode()).toBe(true);
    expect(memoryApi()).toBeNull();
    expect(outbox()).toBeNull();
    expect(writesDisabled()).toBe(true);
    await ensureSession();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('counsel-share-mode: state overlay', () => {
  it('should overlay questions and decisions by finding id / fingerprint and ignore the rest', () => {
    enterCounsel();
    const fp2 = 'd'.repeat(64);
    useReview.setState({
      memory: { byId: { e2: { fingerprint: fp2 } } } as never,
    });
    const decision = (fingerprint: string, d: 'dismissed' | 'accepted'): ActiveDecision =>
      ({
        id: `dec_${d}`,
        fingerprint,
        status: 'active',
        decision: d,
        ...(d === 'dismissed' ? { reason_code: 'false_positive' } : {}),
      }) as unknown as ActiveDecision;
    const n = useReview.getState().mergeRemoteStates(
      [
        SHEET.questions[0]!,
        {
          ...SHEET.questions[0]!,
          id: 'qx',
          finding_id: 'zz',
          finding_key: 'zz',
          fingerprint: 'b'.repeat(64),
        },
      ],
      [decision(fp2, 'dismissed'), decision('c'.repeat(64), 'accepted')],
    );
    expect(n).toBe(2);
    const t = useReview.getState().triage;
    expect(t.e1?.status).toBe('counsel');
    expect(t.e2?.status).toBe('dismissed');
    expect(Object.keys(t).sort()).toEqual(['e1', 'e2']);
  });

  it('should do nothing outside counsel mode', () => {
    expect(useReview.getState().mergeRemoteStates(SHEET.questions, [])).toBe(0);
    expect(useReview.getState().triage).toEqual({});
  });

  it('should map server answers to findings and owners', () => {
    const s: CounselSheetResponse = {
      ...SHEET,
      questions: [
        SHEET.questions[0]!,
        { ...SHEET.questions[0]!, id: 'q2', finding_id: 'f2', finding_key: 'f2@gp', owner: 'gp' },
      ],
      answers: [
        { id: 'a1', question_id: 'q1', option: 'B', answered_by_name: 'Anna', answered_at: 9 },
        {
          id: 'a2',
          question_id: 'q2',
          option: 'A',
          note: 'ok',
          answered_by_name: 'GP',
          answered_at: 10,
        },
        { id: 'a3', question_id: 'missing', option: 'A', answered_by_name: 'X', answered_at: 11 },
      ],
    };
    expect(remoteAnswers(s)).toEqual([
      { findingId: 'e1', option: 'B', by: 'Anna', at: 9 },
      { findingId: 'f2', owner: 'gp', option: 'A', note: 'ok', by: 'GP', at: 10 },
    ]);
  });
});

describe('counsel-share-mode: Share is for bundled demo documents only', () => {
  it('should give a doc ref only for bundled samples and demo packages', () => {
    expect(docRefOf(DOC)).toBe('sample:01');
    expect(docRefOf(UPLOAD)).toBeNull();
    expect(docRefOf({ ...DOC, packageId: 'pk_user' })).toBeNull();
    rememberDemoPackage('pk_demo', 'northgate-iii');
    expect(docRefOf({ ...DOC, packageId: 'pk_demo' })).toBe('package:northgate-iii');
  });

  it('should refuse to share an upload with the demo-only sentence', async () => {
    await expect(
      shareWithCounsel({ doc: UPLOAD, rows: [], findings: [], memory: null, items: [] }),
    ).rejects.toEqual(new ShareError(DEMO_ONLY));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should disable the Share button for an upload with the reason', () => {
    useReview.setState({ doc: UPLOAD });
    mounted = h.renderV2(<CounselScreen />);
    const b = q('counsel-share') as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.title).toBe(DEMO_ONLY);
  });
});

describe('counsel-share-mode: sheet read names the document', () => {
  it('should send the analyst doc_ref, none for counsel, and skip without a demo ref', async () => {
    const sheet = vi.mocked(getSheet);
    sheet.mockClear();
    void refreshSheet(); // the mocked read never settles; the call itself is synchronous
    expect(sheet).toHaveBeenLastCalledWith('sample:01');
    useReview.setState({ doc: UPLOAD });
    sheet.mockClear();
    expect(await refreshSheet()).toBeNull();
    expect(sheet).not.toHaveBeenCalled();
    enterCounsel();
    void refreshSheet();
    expect(sheet).toHaveBeenLastCalledWith(undefined);
  });

  it('should url-encode doc_ref in the analyst sheet request', async () => {
    const { getSheet: realGetSheet } = await vi.importActual<
      typeof import('../../api/counselShareApi')
    >('../../api/counselShareApi');
    const urls: string[] = [];
    setCounselShareFetch({
      url: (p) => p,
      fetch: (async (u: string) => {
        urls.push(u);
        return new Response(JSON.stringify({ ...SHEET, role: 'analyst' }), { status: 200 });
      }) as unknown as typeof fetch,
    });
    try {
      await realGetSheet('package:northgate-iii');
      await realGetSheet();
      await expect(realGetSheet('package:../x')).rejects.toThrow();
    } finally {
      setCounselShareFetch({});
    }
    expect(urls).toEqual([
      '/api/counsel/sheet?doc_ref=package%3Anorthgate-iii',
      '/api/counsel/sheet',
    ]);
  });
});

describe('counsel-share-mode: Mark ready', () => {
  it('should keep Mark ready to digitize disabled while the gate is blocked', () => {
    state.reasons = [{ findingId: 'e1', reason: 'critical_open' }];
    mounted = h.renderV2(<CounselScreen />);
    expect((q('counsel-mark-ready') as HTMLButtonElement).disabled).toBe(true);
  });

  it('should enable Mark ready to digitize once the gate is green', () => {
    mounted = h.renderV2(<CounselScreen />);
    expect((q('counsel-mark-ready') as HTMLButtonElement).disabled).toBe(false);
  });

  it('should capture the share fragment and clean the address bar', () => {
    const replaceState = vi.fn();
    expect(
      captureCounselToken(
        { hash: '#counsel=abc.DEF_-1', pathname: '/', search: '' },
        { replaceState },
      ),
    ).toBe(true);
    expect(useShare.getState().pendingToken).toBe('abc.DEF_-1');
    expect(replaceState).toHaveBeenCalledWith(null, '', '/#counsel');
    expect(
      captureCounselToken(
        { hash: '#counsel=<script>', pathname: '/', search: '' },
        { replaceState },
      ),
    ).toBe(false);
  });
});
