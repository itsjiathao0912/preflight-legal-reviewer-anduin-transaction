import { DOC_REF_RE } from '@aduin/core';
import type { DocMeta } from '../../state/review';

/**
 * Counsel share link (counsel-share-link plan, 19-10-26): a share names a BUNDLED document only,
 * `package:<id>` (public/samples/packages.json) or `sample:<NN>` (public/samples/manifest.json).
 * Counsel's browser re-opens the same bundled files and re-runs the deterministic engine, so the
 * documents are never stored on the server. User uploads and packages the analyst assembled have no
 * ref (Share is disabled for them).
 *
 * `DocMeta.packageId` is the stored package row id for EVERY package (demo or assembled), so it
 * cannot name a demo package by itself: the demo id is remembered per package row when a demo
 * draft is run unchanged (`rememberDemoPackage`), in this tab's sessionStorage (survives a reload).
 */
const KEY = 'aduin:demoPackageRefs';
const SAMPLE_ID_RE = /^\d{2}$/;

function readRefs(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(KEY);
    const o: unknown = raw ? JSON.parse(raw) : {};
    return o && typeof o === 'object' ? (o as Record<string, string>) : {};
  } catch {
    return {};
  }
}

const refs: Record<string, string> = readRefs();

/** Bind a stored package row to the demo package it was opened from (unchanged draft only). */
export function rememberDemoPackage(packageId: string, demoId: string): void {
  const ref = `package:${demoId}`;
  if (!DOC_REF_RE.test(ref)) return;
  refs[packageId] = ref;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(refs));
  } catch {
    /* kept in memory for this tab */
  }
}

/** Test seam. */
export function forgetDemoPackagesForTest(): void {
  resolving.clear();
  demoHashes = null;
  for (const k of Object.keys(refs)) delete refs[k];
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** The shareable ref of an open document, or null (upload, assembled package, unknown). */
export function docRefOf(doc: DocMeta | null | undefined): string | null {
  if (!doc) return null;
  if (doc.packageId) {
    const r = refs[doc.packageId];
    return r && DOC_REF_RE.test(r) ? r : null;
  }
  if (doc.source !== 'sample' || !doc.sampleId || !SAMPLE_ID_RE.test(doc.sampleId)) return null;
  const r = `sample:${doc.sampleId}`;
  return DOC_REF_RE.test(r) ? r : null;
}

/** What a content match needs from the open package (ids are content hashes). */
export interface PackageForRef {
  id: string;
  firmId: string | null;
  docIds: readonly string[];
}

/** Content hashes of one demo package's byte members; null when one cannot be fetched. */
type DemoHashes = { id: string; firmId: string | null; count: number; hashes: string[] };

let demoHashes: Promise<DemoHashes[]> | null = null;
const resolving = new Map<string, Promise<string | null>>();

async function loadDemoHashes(): Promise<DemoHashes[]> {
  const [{ loadDemoPackages }, { loadManifest }, { sha256Hex }] = await Promise.all([
    import('./demo-packages'),
    import('./samples'),
    import('../../engine/ocr-queue'),
  ]);
  const [pkgs, manifest] = await Promise.all([loadDemoPackages(), loadManifest()]);
  const out: DemoHashes[] = [];
  for (const p of pkgs) {
    const hashes: string[] = [];
    let ok = true;
    for (const m of p.members) {
      if (m.kind === 'scan') continue; // scan sets are matched by count only
      const url =
        m.kind === 'file'
          ? m.url
          : (() => {
              const f = manifest.find((s) => s.id === m.sampleId)?.file;
              return f ? `/samples/${f}` : null;
            })();
      if (!url) {
        ok = false;
        break;
      }
      const res = await fetch(url);
      if (!res.ok) {
        ok = false;
        break;
      }
      hashes.push(await sha256Hex(new Uint8Array(await res.arrayBuffer())));
    }
    if (ok && hashes.length)
      out.push({ id: p.id, firmId: p.firmId, count: p.members.length, hashes });
  }
  return out;
}

/** Pure content match: same firm, same member count, every demo byte member present by hash. */
export function matchDemoPackage(pkg: PackageForRef, demos: readonly DemoHashes[]): string | null {
  const ids = new Set(pkg.docIds);
  const hit = demos.find(
    (d) =>
      d.firmId === pkg.firmId && d.count === pkg.docIds.length && d.hashes.every((h) => ids.has(h)),
  );
  return hit ? hit.id : null;
}

/**
 * Derive the demo ref from CONTENT (restored package, "Earlier documents", new tab): the tab memory
 * above is only a fast path. Remembers a hit so the sync `docRefOf` works afterwards. Never throws.
 */
export function resolveDocRef(
  doc: DocMeta | null | undefined,
  pkg: PackageForRef | null | undefined,
): Promise<string | null> {
  const fast = docRefOf(doc);
  if (fast || !doc?.packageId || !pkg || pkg.id !== doc.packageId) return Promise.resolve(fast);
  const key = `${pkg.id}|${pkg.docIds.join(',')}`;
  let p = resolving.get(key);
  if (!p) {
    p = (async () => {
      try {
        demoHashes ??= loadDemoHashes().catch(() => {
          demoHashes = null;
          return [];
        });
        const id = matchDemoPackage(pkg, await demoHashes);
        if (!id) return null;
        rememberDemoPackage(pkg.id, id);
        return docRefOf(doc);
      } catch {
        return null;
      }
    })();
    resolving.set(key, p);
  }
  return p;
}
