import { COUNSEL_NAME_MAX } from '@aduin/core';
import { useState, type FormEvent } from 'react';
import { joinCounsel } from '../../api/counselShareApi';
import { MemoryApiError } from '../../api/memoryApi';
import { Modal } from '../../components/ui/modal';
import { openSharedDocument } from './counsel-boot';
import { useShare } from './counsel-share';

function joinError(e: unknown): string {
  if (e instanceof MemoryApiError) {
    if (e.code === 'unauthorized' || e.status === 401 || e.status === 403 || e.code === 'not_found')
      return 'This link is no longer valid. Ask the analyst for a new one.';
    if (e.code === 'invalid_request' && e.reason === 'name')
      return 'Type your name (1-80 characters).';
    if (e.code === 'rate_limited' || e.code === 'quota_exhausted')
      return 'Too many tries. Wait a moment and try again.';
  }
  return 'The link could not be opened right now. Try again.';
}

/**
 * Counsel link boot (`#counsel=<token>`, captured at startup): one name prompt, then the join call
 * sets the counsel cookie and the app opens the shared bundled document on the Findings screen in
 * counsel mode. Closing the prompt keeps the normal app (the token is dropped).
 */
export function CounselJoinDialog() {
  const token = useShare((s) => s.pendingToken);
  const setPendingToken = useShare((s) => s.setPendingToken);
  const joined = useShare((s) => s.joined);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || busy) return;
    const n = name.trim();
    if (!n) {
      setError('Type your name (1-80 characters).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await joinCounsel(token, n);
      joined(r.counsel_name, r.expires_at, r.doc_ref);
      void openSharedDocument(r.doc_ref);
    } catch (err) {
      setError(joinError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={token !== null}
      onOpenChange={(o) => {
        if (!o && !busy) setPendingToken(null);
      }}
      title="Open the shared review"
      description="An analyst shared a subscription document review with you. Type your name: it is shown next to your answers and comments."
      testId="counsel-join"
    >
      <form className="join-form" onSubmit={(e) => void submit(e)} noValidate>
        <label className="f">
          Your name
          <input
            type="text"
            autoComplete="name"
            maxLength={COUNSEL_NAME_MAX}
            data-testid="counsel-join-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
        </label>
        <div className={error ? 'err on' : 'err'} role="alert" data-testid="counsel-join-error">
          {error}
        </div>
        <div className="acts">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => setPendingToken(null)}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn pri"
            data-testid="counsel-join-submit"
            disabled={busy}
          >
            {busy ? 'Opening…' : 'Open review'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
