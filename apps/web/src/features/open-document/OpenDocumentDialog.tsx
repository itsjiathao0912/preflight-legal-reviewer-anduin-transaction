import { resolveFirm } from '@aduin/core';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Icon } from '../../components/ui/icon';
import { Modal } from '../../components/ui/modal';
import { useReview } from '../../state/review';
import { useSession } from '../../state/session';
import { useShell } from '../../state/shell';
import { openSample, openUpload } from './open-actions';
import { privacyLines } from './privacy-copy';
import { loadFirms, loadManifest, type FirmEntry, type SampleEntry } from './samples';
import { ACCEPT, checkUpload, limitsCopy } from './validate-upload';

export const NO_FIRM = 'Other / no firm';

/**
 * Minimal functional "Open a document" dialog (interim; a Documents view and Upload modal replace it in
 * a later UI phase). Sample picker (one click), upload with limits, firm/fund/version tags, privacy notice.
 * Excluded from the app.html fidelity rubric.
 */
export function OpenDocumentDialog() {
  const open = useShell((s) => s.openDoc);
  const setOpen = useShell((s) => s.setOpenDoc);
  const ackPrivacy = useSession((s) => s.ackPrivacy);
  const privacyAck = useSession((s) => s.privacyAck);
  const showToast = useReview((s) => s.showToast);
  const [samples, setSamples] = useState<SampleEntry[]>([]);
  const [firms, setFirms] = useState<FirmEntry[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [firm, setFirm] = useState('');
  const [fund, setFund] = useState('');
  const [version, setVersion] = useState('');
  const [ack, setAck] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    void loadManifest().then(setSamples);
    void loadFirms().then(setFirms);
    setError('');
    setAck(privacyAck);
  }, [open, privacyAck]);

  const resolved = firm.trim() === NO_FIRM ? null : resolveFirm(firm);
  const resolvedName = resolved ? (firms.find((f) => f.id === resolved)?.name ?? resolved) : '';

  const pickSample = async (s: SampleEntry) => {
    if (s.disabled || busy) return;
    setBusy(true);
    setOpen(false);
    try {
      await openSample(s, firms);
    } catch {
      showToast('The sample could not be opened.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!file) return setError('Choose a file to upload.');
    const check = checkUpload(file.name, file.size);
    if (!check.ok) return setError(check.message);
    const f = firm.trim();
    if (!f) return setError(`Choose the law firm, or "${NO_FIRM}".`);
    if (f !== NO_FIRM && !resolved)
      return setError('Choose a firm from the list. Free text is not accepted.');
    if (!fund.trim()) return setError('Enter the fund name.');
    if (!ack) return setError('Read and accept the privacy notice before uploading.');
    ackPrivacy();
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      setOpen(false);
      await openUpload(
        { name: file.name, bytes },
        {
          firmId: resolved,
          firmName: resolvedName,
          fund: fund.trim(),
          version: version.trim() || 'v1',
        },
      );
    } catch {
      showToast('The file could not be read.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Open a document"
      testId="open-document-dialog"
      className="modal od"
    >
      <div className="od-body">
        <section aria-labelledby="od-samples">
          <h3 className="od-h" id="od-samples">
            Samples <span className="dim">(public SEC filings, open in one click)</span>
          </h3>
          <ul className="od-samples">
            {samples.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="od-sample"
                  data-testid="sample-option"
                  data-sample-id={s.id}
                  disabled={s.disabled || busy}
                  onClick={() => void pickSample(s)}
                >
                  <span className="od-num">#{Number(s.id)}</span>
                  <span className="od-t">{s.title}</span>
                  <span className="dim">
                    {s.disabled
                      ? (s.note ?? 'Later build')
                      : s.firmId
                        ? (firms.find((x) => x.id === s.firmId)?.name ?? s.firmId)
                        : 'No firm'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <form
          onSubmit={(e) => void submit(e)}
          noValidate
          className="od-form"
          aria-labelledby="od-upload"
        >
          <h3 className="od-h" id="od-upload">
            Upload
          </h3>
          <label className="nl">
            File
            <input
              type="file"
              data-testid="upload-input"
              accept={ACCEPT}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError('');
              }}
            />
          </label>
          <p className="mut" data-testid="limits-copy">
            {limitsCopy()}
          </p>
          <label className="nl">
            Law firm <span>(choose from the list; aliases resolve)</span>
            <input
              type="text"
              role="combobox"
              aria-expanded="false"
              aria-autocomplete="list"
              data-testid="firm-combobox"
              list={listId}
              value={firm}
              onChange={(e) => setFirm(e.target.value)}
              autoComplete="off"
            />
            <datalist id={listId}>
              {firms.map((f) => (
                <option key={f.id} value={f.name} />
              ))}
              <option value={NO_FIRM} />
            </datalist>
          </label>
          {firm.trim() === NO_FIRM ? (
            <p className="mut" data-testid="firm-hint">
              No firm: memory not applied for this document.
            </p>
          ) : resolved ? (
            <p className="mut" data-testid="firm-hint">
              Resolves to {resolvedName}
            </p>
          ) : null}
          <div className="od-row">
            <label className="nl">
              Fund name
              <input
                type="text"
                data-testid="fund-input"
                value={fund}
                onChange={(e) => setFund(e.target.value)}
              />
            </label>
            <label className="nl">
              Version label
              <input
                type="text"
                data-testid="version-input"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
            </label>
          </div>
          <div className="od-privacy" data-testid="privacy-notice">
            <p className="od-h">
              <Icon name="shield" /> Privacy notice
            </p>
            {privacyLines().map((l) => (
              <p key={l} className="mut">
                {l}
              </p>
            ))}
            <label className="od-ack">
              <input
                type="checkbox"
                data-testid="privacy-ack"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
              />
              I have read the privacy notice
            </label>
          </div>
          <div className="err on" role="alert" data-testid="upload-error" hidden={!error}>
            {error ? <Icon name="warn" /> : null}
            {error}
          </div>
          <div className="acts od-acts">
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn pri" data-testid="open-submit" disabled={busy}>
              <Icon name="upload" />
              Upload and open
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
