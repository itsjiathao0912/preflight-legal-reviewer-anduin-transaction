import { resolveFirm } from '@aduin/core';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../../components/ui/icon';
import { Modal } from '../../components/ui/modal';
import { usePackage } from '../../state/package';
import { useReview } from '../../state/review';
import { useSession } from '../../state/session';
import { useShell } from '../../state/shell';
import { loadDemoPackages, type DemoPackage } from './demo-packages';
import { openUpload } from './open-actions';
import { openDemoPackage, prepareUploadDraft, runPackageDraft } from './package-actions';
import { PackageConfirmTable } from './PackageConfirmTable';
import { privacyLines } from './privacy-copy';
import { loadFirms, type FirmEntry } from './samples';
import {
  ACCEPT,
  checkPackageFiles,
  checkUpload,
  limitsCopy,
  PACKAGE_LIMITS_COPY,
} from './validate-upload';

export const NO_FIRM = 'Other / no firm';

/**
 * "Open a document" dialog (design/mockups/open-document.html): drop zone for one file or a whole
 * package, firm/fund/version tags, privacy ack, and a collapsed list of demo packages.
 * Excluded from the app.html fidelity rubric.
 */
export function OpenDocumentDialog() {
  const open = useShell((s) => s.openDoc);
  const setOpen = useShell((s) => s.setOpenDoc);
  const ackPrivacy = useSession((s) => s.ackPrivacy);
  const privacyAck = useSession((s) => s.privacyAck);
  const showToast = useReview((s) => s.showToast);
  const [firms, setFirms] = useState<FirmEntry[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const file = files[0] ?? null;
  const [demos, setDemos] = useState<DemoPackage[]>([]);
  const [demoOpen, setDemoOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const draft = usePackage((s) => s.draft);
  const [firm, setFirm] = useState('');
  const [fund, setFund] = useState('');
  const [version, setVersion] = useState('');
  const [ack, setAck] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const listId = useId();

  useEffect(() => {
    if (!open) {
      // intake: closing the modal drops an unconfirmed draft (a running one is left alone)
      if (usePackage.getState().draft?.status === 'ready') usePackage.getState().clearDraft();
      // drop the picked files so the next open starts empty (submit and every close path land here)
      setFiles([]);
      setDragging(false);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    void loadFirms().then(setFirms);
    void loadDemoPackages().then(setDemos);
    setError('');
    setAck(privacyAck);
  }, [open, privacyAck]);

  const resolved = firm.trim() === NO_FIRM ? null : resolveFirm(firm);
  const resolvedName = resolved ? (firms.find((f) => f.id === resolved)?.name ?? resolved) : '';

  /** Intake: a ready draft with exactly one high-confidence subscription agreement auto-runs. */
  const afterDraft = async () => {
    const d = usePackage.getState().draft;
    if (!d || d.status !== 'ready') return;
    const only = d.rows.length === 1 ? d.rows[0] : undefined;
    if (
      only?.type === 'sub_agreement' &&
      only.confidence === 'high' &&
      usePackage.getState().draftReadiness().ok
    ) {
      setOpen(false);
      await runPackageDraft();
    }
  };

  const pickDemo = async (p: DemoPackage) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await openDemoPackage(p.id);
      if (!r.ok) setError(r.message);
      else await afterDraft();
    } catch {
      showToast('The demo package could not be opened.');
    } finally {
      setBusy(false);
    }
  };

  const takeFiles = (list: File[]) => {
    const f = list[0] ?? null;
    setFiles(list);
    // Reject an unsupported, empty or oversized file as soon as it is picked.
    const check =
      list.length > 1 ? checkPackageFiles(list) : f ? checkUpload(f.name, f.size) : null;
    setError(check && !check.ok ? check.message : '');
  };

  const runDraft = async () => {
    setOpen(false);
    await runPackageDraft();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!file) return setError('Choose a file to upload.');
    const check = files.length > 1 ? checkPackageFiles(files) : checkUpload(file.name, file.size);
    if (!check.ok) return setError(check.message);
    const f = firm.trim();
    if (!f) return setError(`Choose the law firm, or "${NO_FIRM}".`);
    if (f !== NO_FIRM && !resolved)
      return setError('Choose a firm from the list. Free text is not accepted.');
    if (!fund.trim()) return setError('Enter the fund name.');
    if (!ack) return setError('Read and accept the privacy notice before uploading.');
    ackPrivacy();
    setBusy(true);
    if (files.length > 1) {
      // intake: many files -> light read + confirmation table (version label required there)
      try {
        const r = await prepareUploadDraft(files, {
          firmId: resolved,
          firmName: resolvedName,
          fund: fund.trim(),
          version: version.trim(),
        });
        if (!r.ok) setError(r.message);
        else await afterDraft();
      } catch {
        showToast('The files could not be read.');
      } finally {
        setBusy(false);
      }
      return;
    }
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

  const totalMb = files.reduce((n, f) => n + f.size, 0) / 1024 / 1024;
  const ext = (name: string) => (name.split('.').pop() ?? '').toUpperCase().slice(0, 4);

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Open a document"
      description="Upload a sub doc or a whole fund package. Files stay in this browser for 24 hours."
      testId="open-document-dialog"
      className={draft ? 'modal od od-pkg' : 'modal od'}
    >
      <button type="button" className="od-x" aria-label="Close" onClick={() => setOpen(false)}>
        <Icon name="x" />
      </button>
      {draft ? (
        <PackageConfirmTable
          onRun={() => void runDraft()}
          onBack={() => usePackage.getState().clearDraft()}
        />
      ) : null}
      <form
        onSubmit={(e) => void submit(e)}
        noValidate
        className="od-form"
        aria-label="Upload"
        hidden={!!draft}
      >
        <div
          className={`od-drop${dragging ? ' over' : ''}${files.length ? ' compact' : ''}`}
          data-testid="upload-dropzone"
          role="button"
          tabIndex={0}
          aria-label="Upload files: drag here or browse"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const list = Array.from(e.dataTransfer.files);
            if (list.length) takeFiles(files.length ? [...files, ...list] : list);
          }}
          onClick={() => inputRef.current?.click()}
        >
          <span className="od-drop-ic">
            <Icon name="upload" />
          </span>
          <span className="od-drop-t">
            <strong>
              {dragging
                ? 'Drop to add files'
                : files.length
                  ? 'Add more files, or '
                  : 'Drag files here, or '}
              {dragging ? null : <span className="od-link">browse</span>}
            </strong>
            {files.length ? (
              <small>
                {files.length} of 12 files · {totalMb.toFixed(1)} of 40 MB
              </small>
            ) : (
              <>
                <small data-testid="limits-copy">{limitsCopy()}</small>
                <small data-testid="package-limits-copy">{PACKAGE_LIMITS_COPY}</small>
              </>
            )}
          </span>
          <input
            ref={inputRef}
            type="file"
            data-testid="upload-input"
            accept={ACCEPT}
            multiple
            hidden
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const list = Array.from(e.target.files ?? []);
              takeFiles(files.length && list.length ? [...files, ...list] : list);
              e.target.value = '';
            }}
          />
        </div>

        {files.length ? (
          <>
            <ul className="od-files" aria-label="Files to upload">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="od-file">
                  <span className={`od-ft od-ft-${ext(f.name).toLowerCase()}`}>{ext(f.name)}</span>
                  <span className="od-fn">
                    <b>{f.name}</b>
                    <span>{(f.size / 1024).toFixed(0)} KB</span>
                  </span>
                  <button
                    type="button"
                    className="od-rm"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => takeFiles(files.filter((_, j) => j !== i))}
                  >
                    <Icon name="x" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="od-fields">
              <label className="nl">
                Law firm
                <input
                  type="text"
                  role="combobox"
                  aria-expanded="false"
                  aria-autocomplete="list"
                  data-testid="firm-combobox"
                  list={listId}
                  value={firm}
                  placeholder="Choose from the list"
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
                <span className="od-lbl">
                  Version <em>optional</em>
                </span>
                <input
                  type="text"
                  data-testid="version-input"
                  value={version}
                  placeholder="e.g. v3 draft"
                  onChange={(e) => setVersion(e.target.value)}
                />
              </label>
            </div>
            {firm.trim() === NO_FIRM ? (
              <p className="mut od-hint" data-testid="firm-hint">
                No firm: memory not applied for this document.
              </p>
            ) : resolved ? (
              <p className="mut od-hint" data-testid="firm-hint">
                Resolves to {resolvedName}
              </p>
            ) : null}

            <div className="od-privacy" data-testid="privacy-notice">
              <input
                type="checkbox"
                id="od-ack"
                data-testid="privacy-ack"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
              />
              <div>
                <label htmlFor="od-ack">I have read the privacy notice.</label>{' '}
                <details>
                  <summary>What gets sent?</summary>
                  <ul>
                    {privacyLines().map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </details>
              </div>
            </div>
          </>
        ) : null}

        <div
          className={error ? 'err on' : 'err'}
          role="alert"
          data-testid="upload-error"
          hidden={!error}
        >
          {error ? <Icon name="warn" /> : null}
          {error}
        </div>

        {demos.length ? (
          <div className="od-demo">
            <button
              type="button"
              className="od-demo-tg"
              aria-expanded={demoOpen}
              aria-controls="od-demo-list"
              data-testid="demo-toggle"
              onClick={() => setDemoOpen(!demoOpen)}
            >
              <Icon name="chev" className="od-chev" />
              <b>Or try a demo package</b>
              <span className="dim">{demos.length} packages</span>
              <span className="od-free">Free, no AI quota</span>
            </button>
            <ul id="od-demo-list" className="od-demos" hidden={!demoOpen}>
              {demos.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="od-demo-row"
                    data-testid="package-sample-option"
                    data-package-id={p.id}
                    disabled={busy}
                    onClick={() => void pickDemo(p)}
                  >
                    <b>{p.title}</b>
                    <span>
                      {p.members.length} file{p.members.length === 1 ? '' : 's'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="od-foot">
          <span className="od-foot-hint">
            {files.length ? '' : 'Add files or pick a demo package to start.'}
          </span>
          <button type="button" className="btn" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button type="submit" className="btn pri" data-testid="open-submit" disabled={busy}>
            <Icon name="upload" />
            {files.length > 1 ? `Open package (${files.length} files)` : 'Upload and open'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
