import { useEffect, useState } from 'react';
import { reopenRecent } from '../open-document/open-actions';
import { useReview, type DocMeta } from '../../state/review';
import { useShell } from '../../state/shell';
import { appDb, RETENTION_MS } from '../../storage/db';

interface Row {
  meta: DocMeta;
  createdAt?: number;
  files?: number;
}

/** Uploads still kept in this browser (24 h): one row per package (its primary), newest first. */
async function loadStoredUploads(recent: DocMeta[]): Promise<Row[]> {
  const db = appDb();
  if (!db) return [];
  try {
    const now = Date.now();
    const [docs, pkgs] = await Promise.all([db.documents.toArray(), db.packages.toArray()]);
    const byPkg = new Map(pkgs.map((p) => [p.id, p]));
    const firmOf = (id: string | null) =>
      id ? (recent.find((r) => r.firmId === id)?.firmName ?? id) : '';
    const rows: Row[] = [];
    for (const d of docs) {
      if (d.createdAt <= now - RETENTION_MS) continue;
      const p = d.packageId ? byPkg.get(d.packageId) : undefined;
      if (d.packageId && p && p.primaryDocId !== d.id) continue; // non-primary member
      rows.push({
        meta: {
          id: d.id,
          name: d.name,
          firmId: d.firmId,
          firmName: p ? p.firmName : firmOf(d.firmId),
          fund: d.fund,
          version: d.version,
          source: 'upload',
          ref: d.id,
          ...(p ? { packageId: p.id } : {}),
        },
        createdAt: d.createdAt,
        files: p?.docs.length,
      });
    }
    return rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  } catch {
    return [];
  }
}

const hhmm = (t: number) =>
  new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** "today 11:41 AM" / "tomorrow 11:41 AM", else a short date like "Oct 19, 11:41 AM". */
function whenLabel(t: number, now = Date.now()): string {
  const day = (x: number) => new Date(x).toDateString();
  if (day(t) === day(now)) return `today ${hhmm(t)}`;
  if (day(t) === day(now + 86_400_000)) return `tomorrow ${hhmm(t)}`;
  return new Date(t).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** #documents: samples opened this session plus every upload still stored in this browser. */
export function DocumentsView() {
  const doc = useReview((s) => s.doc);
  const recent = useReview((s) => s.recent);
  const setOpenDoc = useShell((s) => s.setOpenDoc);
  const [stored, setStored] = useState<Row[]>([]);
  useEffect(() => {
    let live = true;
    void loadStoredUploads(recent).then((r) => live && setStored(r));
    return () => {
      live = false;
    };
  }, [recent]);

  const storedRefs = new Set(stored.map((r) => r.meta.ref));
  const rows: Row[] = [
    ...stored,
    ...recent
      .filter((d) => d.source !== 'upload' || !storedRefs.has(d.ref))
      .map((d) => ({ meta: d })),
  ];
  const isCurrent = (m: DocMeta) =>
    !!doc && (doc.id === m.id || (m.source === 'upload' && doc.ref === m.ref));

  const openBtn = (
    <button
      type="button"
      className="btn pri"
      data-testid="documents-open"
      onClick={() => setOpenDoc(true)}
    >
      Open another document…
    </button>
  );
  return (
    <section className="view" aria-labelledby="h-documents" data-testid="documents-view">
      <header className="pagehead">
        <div className="tt">
          <h1 id="h-documents" tabIndex={-1}>
            Documents
          </h1>
          <p className="docnote">Uploads stay in this browser for 24 hours.</p>
        </div>
      </header>
      <div className="pgbody">
        {rows.length === 0 ? (
          <div className="empty2" data-testid="documents-empty">
            <p className="ph-t">No documents yet. Upload a document or open a sample.</p>
            {openBtn}
          </div>
        ) : (
          <>
            <ul className="doclist" aria-label="Recent documents">
              {rows.map(({ meta: d, createdAt, files }) => (
                <li key={d.id}>
                  <button
                    type="button"
                    className="docrow"
                    data-testid="documents-row"
                    aria-current={isCurrent(d) ? 'true' : undefined}
                    onClick={() => void reopenRecent(d)}
                  >
                    <span>
                      <b>{d.name}</b>
                      <span className="df">{d.firmName || 'No firm'}</span>
                      {createdAt !== undefined && (
                        <span className="df">
                          Uploaded {hhmm(createdAt)} · kept until{' '}
                          {whenLabel(createdAt + RETENTION_MS)}
                        </span>
                      )}
                    </span>
                    <span className="docsrc">
                      {files !== undefined
                        ? `Package · ${files} files`
                        : d.source === 'upload'
                          ? 'Upload'
                          : 'Sample'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {openBtn}
          </>
        )}
      </div>
    </section>
  );
}
