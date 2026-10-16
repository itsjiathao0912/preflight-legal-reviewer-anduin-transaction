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
  pages?: number;
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
