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
