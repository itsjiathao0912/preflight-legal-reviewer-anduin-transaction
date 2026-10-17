import {
  buildDriftNarrativeCandidates,
  readDriftNarrative,
  type DiffResult,
  type NarrativeLine,
} from '@aduin/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiEnabled } from '../../api/base';
import { Icon } from '../../components/ui/icon';
import { useSession } from '../../state/session';
import { BANNERS, bannerFor, type BannerKey } from '../ai/banner-map';
import { AI_SUGGESTION } from '../ai/Provenance';
import { requestAi } from '../ai/stream-client';

/**
 * "AI summary" of the rename drift (Phase 07c, AC15 H part). Optional and explicit: the analyst
 * presses "Summarize changes" (no call on open). The request carries only the renames the
 * deterministic diff found plus masked, clipped sample sentences (built in core, E18); the answer
 * is filtered again so a line that does not name its rename is never shown. The deterministic
 * diff never depends on this section.
 */
type State =
  | { s: 'idle' }
  | { s: 'pending' }
  | { s: 'done'; lines: NarrativeLine[]; model: string; cache: 'hit' | 'miss' }
  | { s: 'skipped'; key: BannerKey };

export function AiSummary({ result }: { result: DiffResult }) {
  const aiOn = useSession((x) => x.aiOn);
  const candidates = useMemo(() => buildDriftNarrativeCandidates(result), [result]);
  const [st, setSt] = useState<State>({ s: 'idle' });
  const ctl = useRef<AbortController | null>(null);

  useEffect(() => {
    setSt({ s: 'idle' });
    return () => {
      ctl.current?.abort();
      ctl.current = null;
    };
  }, [result]);

  const run = async () => {
    ctl.current?.abort();
    const ac = new AbortController();
    ctl.current = ac;
    setSt({ s: 'pending' });
    const t = await requestAi({
      task: 'drift-narrative',
      lawFirmId: null,
      candidates,
      signal: ac.signal,
    });
    if (ac.signal.aborted || ctl.current !== ac) return;
    ctl.current = null;
    if (t.kind === 'aborted') return setSt({ s: 'idle' });
    if (t.kind === 'error') return setSt({ s: 'skipped', key: bannerFor(t.error) });
    const lines = t.resultKind === 'ai' ? readDriftNarrative(t.data, candidates) : null;
    if (!lines || lines.length === 0) return setSt({ s: 'skipped', key: 'result_unusable' });
    setSt({ s: 'done', lines, model: t.model, cache: t.cache });
    if (t.cache === 'miss') void useSession.getState().refreshQuota();
  };

  let body: React.ReactNode;
  let state: string;
  if (candidates.length === 0) {
    state = 'none';
    body = <p className="mut">No renamed terms to summarize.</p>;
  } else if (!aiOn) {
    state = 'off';
    body = <p className="mut">AI is off. Turn AI on to summarize the renamed terms.</p>;
  } else if (!apiEnabled()) {
    state = 'unavailable';
    body = <p className="mut">AI summary is not available in this build.</p>;
  } else if (st.s === 'pending') {
    state = 'pending';
    body = (
      <p className="mut" role="status">
        Summarizing {candidates.length} renamed terms…
      </p>
    );
  } else if (st.s === 'done') {
    state = 'done';
    body = (
      <>
        <ul className="ainar" data-testid="cmp-ai-lines">
          {st.lines.map((l) => (
            <li key={`${l.from}>${l.to}`} data-testid="cmp-ai-line">
              <b>
                {l.from} → {l.to}
              </b>{' '}
              {l.text}
            </li>
          ))}
        </ul>
        <p className="mut" data-testid="cmp-ai-provenance">
          <span className="tag t-ai" data-testid="ai-suggestion-label">
            <Icon name="spark" />
            {AI_SUGGESTION}
          </span>{' '}
          {st.model} · {st.cache === 'hit' ? 'from cache' : 'fresh'} · only renames found by the
          rule-based diff are shown; check the wording against the clauses.
        </p>
      </>
    );
  } else if (st.s === 'skipped') {
    state = 'skipped';
    body = (
      <p className="mut" role="status" data-reason={st.key}>
        AI summary skipped: <b>{BANNERS[st.key].reason}</b>. The rule-based comparison is
        unaffected.{' '}
        <button type="button" className="btn" data-testid="cmp-ai-retry" onClick={() => void run()}>
          Retry
        </button>
      </p>
    );
  } else {
    state = 'idle';
    body = (
      <p className="mut">
        <button type="button" className="btn" data-testid="cmp-ai-run" onClick={() => void run()}>
          <Icon name="spark" />
          Summarize changes
        </button>{' '}
        Sends {candidates.length} renamed terms with short masked sample sentences.
      </p>
    );
  }

  return (
    <section className="aisum" aria-label="AI summary" data-testid="cmp-ai" data-state={state}>
      <h3>AI summary</h3>
      {body}
    </section>
  );
}
