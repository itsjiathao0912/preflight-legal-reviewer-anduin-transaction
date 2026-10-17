import { resolveFirm } from '@aduin/core';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Icon } from '../../components/ui/icon';
import { Modal } from '../../components/ui/modal';
import { usePackage } from '../../state/package';
import { useReview } from '../../state/review';
import { useSession } from '../../state/session';
import { useShell } from '../../state/shell';
import type { StoredPackage } from '../../storage/db';
import { loadDemoPackages, type DemoPackage } from './demo-packages';
import { openSample, openUpload } from './open-actions';
import {
  openDemoPackage,
  prepareUploadDraft,
  restorePackage,
  runPackageDraft,
} from './package-actions';
import { PackageConfirmTable } from './PackageConfirmTable';
import { privacyLines } from './privacy-copy';
import { loadFirms, loadManifest, type FirmEntry, type SampleEntry } from './samples';
import {
  ACCEPT,
  checkPackageFiles,
  checkUpload,
  limitsCopy,
  PACKAGE_LIMITS_COPY,
} from './validate-upload';

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
  const [files, setFiles] = useState<File[]>([]);
  const file = files[0] ?? null;
  const [demos, setDemos] = useState<DemoPackage[]>([]);
  const [recentPkgs, setRecentPkgs] = useState<StoredPackage[]>([]);
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
      return;
    }
    void loadManifest().then(setSamples);
    void loadFirms().then(setFirms);
    void loadDemoPackages().then(setDemos);
    void usePackage.getState().listRecent().then(setRecentPkgs);
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

  const pickRecent = async (p: StoredPackage) => {
    if (busy) return;
    setBusy(true);
    setOpen(false);
    try {
      if (!(await restorePackage(p.id)))
        showToast('This package is no longer stored in this browser.');
    } catch {
      showToast('The package could not be opened.');
    } finally {
      setBusy(false);
    }
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

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Open a document"
      testId="open-document-dialog"
      className={draft ? 'modal od od-pkg' : 'modal od'}
    >
      {draft ? (
        <PackageConfirmTable
          onRun={() => void runDraft()}
          onBack={() => usePackage.getState().clearDraft()}
        />
      ) : null}
      <div className="od-body" hidden={!!draft}>
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
                  <span className="od-num">{/^\d+$/.test(s.id) ? `#${Number(s.id)}` : 'H&C'}</span>
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
          {demos.length ? (
            <>
              <h3 className="od-h" id="od-demo-packages">
                Demo packages <span className="dim">(several documents of one fund)</span>
              </h3>
              <ul className="pkg-lists od-samples" aria-labelledby="od-demo-packages">
                {demos.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="od-sample"
                      data-testid="package-sample-option"
                      data-package-id={p.id}
                      disabled={busy}
                      onClick={() => void pickDemo(p)}
                    >
                      <span className="od-t">{p.title}</span>
                      <span className="dim">
                        {p.members.length} file{p.members.length === 1 ? '' : 's'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {recentPkgs.length ? (
            <>
              <h3 className="od-h" id="od-recent-packages">
                Recent packages <span className="dim">(this browser, 24 h)</span>
              </h3>
              <ul className="pkg-lists od-samples" aria-labelledby="od-recent-packages">
                {recentPkgs.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="od-sample"
                      data-testid="package-recent-option"
                      data-package-id={p.id}
                      disabled={busy}
                      onClick={() => void pickRecent(p)}
                    >
                      <span className="od-t">
                        {p.fund} {p.version}
                      </span>
                      <span className="dim">
                        {p.firmName || 'No firm'} · {p.docs.length} files
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
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
              multiple
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []);
                const f = list[0] ?? null;
                setFiles(list);
                // Reject an unsupported, empty or oversized file as soon as it is picked.
                const check =
                  list.length > 1
                    ? checkPackageFiles(list)
                    : f
                      ? checkUpload(f.name, f.size)
                      : null;
                setError(check && !check.ok ? check.message : '');
              }}
            />
          </label>
          <p className="mut" data-testid="limits-copy">
            {limitsCopy()}
          </p>
          <p className="mut" data-testid="package-limits-copy">
            {PACKAGE_LIMITS_COPY}
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
          <div
            className={error ? 'err on' : 'err'}
            role="alert"
            data-testid="upload-error"
            hidden={!error}
          >
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
