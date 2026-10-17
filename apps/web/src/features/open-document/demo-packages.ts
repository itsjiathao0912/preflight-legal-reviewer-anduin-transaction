/** Demo packages written by scripts/src/build-samples.ts into public/samples/packages.json. */
export type DemoPackageMember =
  | { kind: 'file'; name: string; url: string }
  | { kind: 'sample'; sampleId: string }
  | { kind: 'scan'; sampleId: string };

export interface DemoPackage {
  id: string;
  title: string;
  firmId: string | null;
  fund: string;
  version: string;
  members: DemoPackageMember[];
}

const URL_RE = /^\/samples\/packages\/[a-z0-9-]{1,40}\/[A-Za-z0-9._-]{1,120}$/;

function isMember(x: unknown): x is DemoPackageMember {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (o.kind === 'file')
    return typeof o.name === 'string' && typeof o.url === 'string' && URL_RE.test(o.url);
  return (
    (o.kind === 'sample' || o.kind === 'scan') &&
    typeof o.sampleId === 'string' &&
    /^\d{2}$/.test(o.sampleId)
  );
}

function isPackage(x: unknown): x is DemoPackage {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    /^[a-z0-9-]{1,40}$/.test(o.id) &&
    typeof o.title === 'string' &&
    (o.firmId === null || typeof o.firmId === 'string') &&
    typeof o.fund === 'string' &&
    typeof o.version === 'string' &&
    Array.isArray(o.members) &&
    o.members.length > 0 &&
    o.members.every(isMember)
  );
}

let cached: Promise<DemoPackage[]> | null = null;
/** Validated demo package list (static file, still checked like any input). */
export function loadDemoPackages(): Promise<DemoPackage[]> {
  cached ??= fetch('/samples/packages.json')
    .then((r) => (r.ok ? r.json() : { packages: [] }))
    .then((j: unknown) => {
      const list = (j as { packages?: unknown }).packages;
      return Array.isArray(list) ? list.filter(isPackage) : [];
    })
    .catch(() => []);
  return cached;
}
