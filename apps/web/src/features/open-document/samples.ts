/** Sample manifest written by scripts/src/build-samples.ts into public/samples/manifest.json. */
export interface SampleEntry {
  id: string;
  file: string | null;
  title: string;
  firmId: string | null;
  fund: string;
  version: string;
  kind: 'html' | 'scan';
  disabled: boolean;
  note?: string;
  /** Scan set (Phase 06f): ordered page images with the sha256 of each ORIGINAL page. */
  pages?: ScanPageEntry[];
}

export interface ScanPageEntry {
  n: number;
  file: string;
  sourceHash: string;
}

const PAGE_FILE_RE = /^[A-Za-z0-9._-]{1,80}\/p\d{2}\.jpg$/;

/** Validated page list of a scan entry (manifest is static, but checked like any input). */
export function scanPagesOf(s: SampleEntry): ScanPageEntry[] {
  if (s.kind !== 'scan' || !Array.isArray(s.pages)) return [];
  return s.pages
    .filter(
      (p): p is ScanPageEntry =>
        !!p &&
        typeof p === 'object' &&
        Number.isInteger(p.n) &&
        typeof p.file === 'string' &&
        PAGE_FILE_RE.test(p.file) &&
        typeof p.sourceHash === 'string' &&
        /^[0-9a-f]{64}$/.test(p.sourceHash),
    )
    .slice(0, 30);
}

export interface FirmEntry {
  id: string;
  name: string;
  aliases: string[];
}

function isSample(x: unknown): x is SampleEntry {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    (o.file === null || typeof o.file === 'string') &&
    typeof o.title === 'string' &&
    (o.firmId === null || typeof o.firmId === 'string') &&
    typeof o.fund === 'string' &&
    typeof o.version === 'string' &&
    typeof o.disabled === 'boolean'
  );
}

let manifest: Promise<SampleEntry[]> | null = null;
export function loadManifest(): Promise<SampleEntry[]> {
  manifest ??= fetch('/samples/manifest.json')
    .then((r) => (r.ok ? r.json() : { samples: [] }))
    .then((j: unknown) => {
      const list = (j as { samples?: unknown }).samples;
      return Array.isArray(list) ? list.filter(isSample) : [];
    })
    .catch(() => []);
  return manifest;
}

let firms: Promise<FirmEntry[]> | null = null;
export function loadFirms(): Promise<FirmEntry[]> {
  firms ??= fetch('/firms.json')
    .then((r) => (r.ok ? r.json() : { firms: [] }))
    .then((j: unknown) => {
      const list = (j as { firms?: unknown }).firms;
      return Array.isArray(list)
        ? list.filter(
            (f): f is FirmEntry =>
              !!f &&
              typeof f === 'object' &&
              typeof (f as FirmEntry).id === 'string' &&
              typeof (f as FirmEntry).name === 'string',
          )
        : [];
    })
    .catch(() => []);
  return firms;
}
