import {
  PACKAGE_DOC_ROLES,
  PACKAGE_DOC_TYPES,
  type PackageDocRole,
  type PackageDocType,
} from '@aduin/core';
import { usePackage } from '../../state/package';
import type { DocMeta } from '../../state/review';

/**
 * Counsel share link, package configuration (19-10-26). A demo package draft can need the analyst's
 * confirmation (low-confidence rows, two subscription agreements both suggested "To digitize"), so
 * counsel's browser cannot run the bundled package by itself, and the roles decide which findings
 * exist (definition sources) and what Changes compare against (baseline). The analyst's link
 * therefore carries the package's type and role per member in the URL fragment, next to the token:
 * `#counsel=<token>&cfg=<base64url JSON>`. Presentation only, not secret; a fragment is never sent
 * to the server. Members are named by a prefix of their content hash (= draft row id), so file
 * names and order do not matter. Finding ids depend on the document content only (detector, class,
 * anchor, quote hash), never on timestamps or the version label.
 */
export interface PackageDocConfig {
  /** Content-hash prefix of the member (row id). */
  h: string;
  t: PackageDocType;
  r: PackageDocRole;
}

export interface PackageConfig {
  docs: PackageDocConfig[];
  /** Version label of the analyst's package (display only). */
  version?: string;
}

const HASH_PREFIX = 16;
const MAX_DOCS = 32;
const MAX_VERSION = 80;
const MAX_ENCODED = 4096;
const ENCODED_RE = /^[A-Za-z0-9_-]{1,4096}$/;
const HASH_RE = /^[0-9a-f]{16}$/;

function toBase64Url(s: string): string {
  let bin = '';
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** The open package's configuration (analyst, at share time), or null for a non-package doc. */
export function packageConfigOf(doc: DocMeta | null | undefined): PackageConfig | null {
  const c = usePackage.getState().current;
  if (!doc?.packageId || !c || c.id !== doc.packageId) return null;
  const docs = c.docs
    .filter((d) => /^[0-9a-f]{16,}$/.test(d.id))
    .slice(0, MAX_DOCS)
    .map((d) => ({ h: d.id.slice(0, HASH_PREFIX), t: d.type, r: d.role }));
  if (!docs.length) return null;
  const version = c.tag.version.trim().slice(0, MAX_VERSION);
  return { docs, ...(version ? { version } : {}) };
}

export function encodePackageConfig(cfg: PackageConfig): string {
  return toBase64Url(
    JSON.stringify({
      v: 1,
      ...(cfg.version ? { ver: cfg.version } : {}),
      d: cfg.docs.map((d) => [d.h, d.t, d.r]),
    }),
  );
}

/** Strict decode of an untrusted fragment value; anything malformed is null (defaults apply). */
export function decodePackageConfig(s: string | null | undefined): PackageConfig | null {
  if (!s || s.length > MAX_ENCODED || !ENCODED_RE.test(s)) return null;
  let o: unknown;
  try {
    o = JSON.parse(fromBase64Url(s));
  } catch {
    return null;
  }
  if (!o || typeof o !== 'object') return null;
  const { v, ver, d } = o as { v?: unknown; ver?: unknown; d?: unknown };
  if (v !== 1 || !Array.isArray(d) || d.length === 0 || d.length > MAX_DOCS) return null;
  if (ver !== undefined && (typeof ver !== 'string' || ver.length > MAX_VERSION)) return null;
  const docs: PackageDocConfig[] = [];
  for (const e of d) {
    if (!Array.isArray(e) || e.length !== 3) return null;
    const [h, t, r] = e as unknown[];
    if (typeof h !== 'string' || !HASH_RE.test(h)) return null;
    if (!(PACKAGE_DOC_TYPES as readonly unknown[]).includes(t)) return null;
    if (!(PACKAGE_DOC_ROLES as readonly unknown[]).includes(r)) return null;
    docs.push({ h, t: t as PackageDocType, r: r as PackageDocRole });
  }
  const version = typeof ver === 'string' ? ver.trim() : '';
  return { docs, ...(version ? { version } : {}) };
}

/**
 * Counsel: make the freshly prepared demo draft match the analyst's package, then confirm every
 * row (nobody on counsel's side answers "Need your confirmation"). With a config: each row takes
 * the analyst's type and role, rows the analyst did not run are removed. Without one (older links)
 * or when no row matches: the suggested defaults are confirmed, and when several rows are suggested
 * "To digitize" the first stays and the others become the baseline (reference if refused).
 */
export function applyPackageConfig(cfg: PackageConfig | null): void {
  const store = usePackage.getState();
  const draft = store.draft;
  if (!draft) return;
  const byHash = new Map((cfg?.docs ?? []).map((d) => [d.h, d]));
  const match = (id: string) => byHash.get(id.slice(0, HASH_PREFIX));
  if (cfg && draft.rows.some((r) => match(r.id))) {
    for (const row of draft.rows) {
      const want = match(row.id);
      if (!want) {
        usePackage.getState().removeDraftRow(row.id);
        continue;
      }
      // type first: "To digitize" needs a subscription agreement
      if (want.t !== row.type) usePackage.getState().setDraftField(row.id, 'type', want.t);
      const now = usePackage.getState().draft?.rows.find((r) => r.id === row.id);
      if (now && now.role !== want.r) usePackage.getState().setDraftField(row.id, 'role', want.r);
    }
    if (cfg.version) usePackage.getState().setDraftTag({ version: cfg.version });
  } else {
    const primaries = draft.rows.filter((r) => r.role === 'to_digitize');
    for (const extra of primaries.slice(1)) {
      const r = usePackage.getState().setDraftField(extra.id, 'role', 'baseline');
      if (!r.ok) usePackage.getState().setDraftField(extra.id, 'role', 'reference');
    }
  }
  for (const row of usePackage.getState().draft?.rows ?? [])
    if (!row.confirmed) usePackage.getState().confirmDraftRow(row.id);
}
