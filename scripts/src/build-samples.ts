/**
 * build-samples: copies the public HTML sample corpus into apps/web/public/samples/ and writes
 * manifest.json (firm / fund / version tags) plus apps/web/public/firms.json.
 *
 * Single samples mechanism for @aduin/web (Phase 03): run by the prebuild / prebuild:e2e / predev /
 * pretest:e2e / pretest:a11y scripts. Idempotent. Output is gitignored.
 *
 * Corpus (D-7): 12 HTML samples (01-08, 10-13) plus the 22-page scan set #9 (Phase 06f: downscaled
 * page images, see samples/scan-set.ts). #14 (ILPA, local-only) is never copied.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildScanSet, SCAN_URL_PREFIX } from './samples/scan-set';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = join(ROOT, 'samples', 'sub-docs', 'raw');
const FIRMS_SRC = join(ROOT, 'fixtures', 'memory', 'law-firms.json');
const OUT = join(ROOT, 'apps', 'web', 'public');
const OUT_SAMPLES = join(OUT, 'samples');
const PKG_SRC = join(ROOT, 'fixtures', 'package', 'demo-packages.json');
const OUT_PACKAGES = join(OUT_SAMPLES, 'packages');

/** Intake Phase 2: one demo package member in public/samples/packages.json. */
export type DemoPackageMember =
  | { kind: 'file'; name: string; url: string }
  | { kind: 'sample'; sampleId: string }
  | { kind: 'scan'; sampleId: string };

export interface DemoPackageEntry {
  id: string;
  title: string;
  firmId: string | null;
  fund: string;
  version: string;
  members: DemoPackageMember[];
}

/** Display tags of the demo packages (fixtures/package/demo-packages.json carries ids and members). */
const PACKAGE_TAGS: Record<string, { title: string; fund: string; version: string }> = {
  'northgate-iii': {
    title: 'Northgate Capital III',
    fund: 'Northgate Capital Fund III',
    version: 'v1',
  },
  'lotus-bay-asia-ii': {
    title: 'Lotus Bay Asia II',
    fund: 'Lotus Bay Asia Fund II',
    version: 'v2',
  },
  'redwood-ridge-i': { title: 'Redwood Ridge I', fund: 'Redwood Ridge Fund I', version: 'v1' },
  hartwell: { title: 'Hartwell Fund III (synthetic)', fund: 'Hartwell Fund III', version: 'v1' },
  ngi: {
    title: 'PG NGI 2024 + 2026',
    fund: 'Partners Group Next Generation Infrastructure',
    version: '2026',
  },
  'rw-scans': { title: 'RW Holdings scans', fund: 'RW Holdings NNN REIT', version: 'scan set' },
  'blackstone-appendix': {
    title: 'Blackstone REIT Appendix B',
    fund: 'Blackstone Real Estate Income Trust',
    version: '2024',
  },
};
const DESIGN_PREFIX = 'fixtures/package/design/';

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
  /** Scan set only (Phase 06f): ordered page images with the original-bytes sha256. */
  pages?: { n: number; file: string; sourceHash: string }[];
}

/** Tags per sample number. #3-#6 are one firm (partners-group). Others carry no firm tag. */
const TAGS: Record<
  string,
  { title: string; firmId: string | null; fund: string; version: string }
> = {
  '01': {
    title: 'Franklin Lexington PMF 2024',
    firmId: null,
    fund: 'Franklin Lexington Private Markets Fund',
    version: '2024',
  },
  '02': {
    title: 'Coatue Innovation Fund 2025',
    firmId: null,
    fund: 'Coatue Innovation Fund',
    version: '2025',
  },
  '03': {
    title: 'PG Master Fund 2019',
    firmId: 'partners-group',
    fund: 'Partners Group Private Equity (Master Fund)',
    version: '2019',
  },
  '04': {
    title: 'PG TEI 2016',
    firmId: 'partners-group',
    fund: 'Partners Group Private Equity (TEI)',
    version: '2016',
  },
  '05': {
    title: 'PG NGI 2024',
    firmId: 'partners-group',
    fund: 'Partners Group Next Generation Infrastructure',
    version: '2024',
  },
  '06': {
    title: 'PG NGI 2026',
    firmId: 'partners-group',
    fund: 'Partners Group Next Generation Infrastructure',
    version: '2026',
  },
  '07': {
    title: 'Cottonwood Multifamily REIT II 2016',
    firmId: null,
    fund: 'Cottonwood Multifamily REIT II',
    version: '2016',
  },
  '08': { title: 'Modiv REIT 2021', firmId: null, fund: 'Modiv REIT', version: '2021' },
  '09': {
    title: 'RW Holdings scans (22 pages)',
    firmId: null,
    fund: 'RW Holdings NNN REIT',
    version: 'scan set',
  },
  '10': {
    title: 'CrowdStreet REIT I 2022',
    firmId: null,
    fund: 'CrowdStreet REIT I',
    version: '2022',
  },
  '11': {
    title: 'Medalist Diversified REIT 2016',
    firmId: null,
    fund: 'Medalist Diversified REIT',
    version: '2016',
  },
  '12': {
    title: 'Fortress Net Lease REIT 2024',
    firmId: null,
    fund: 'Fortress Net Lease REIT',
    version: '2024',
  },
  '13': {
    title: 'Blackstone REIT 2024 (Appendix B)',
    firmId: null,
    fund: 'Blackstone Real Estate Income Trust',
    version: '2024',
  },
};

const HTML_IDS = ['01', '02', '03', '04', '05', '06', '07', '08', '10', '11', '12', '13'];

/**
 * Variance Phase 05 (B1): Hartwell & Crane demo documents (authored corpus fixtures/variance/
 * hartwell-crane). Non-numeric ids, appended after the 12 originals; single documents only (a
 * bundled sample never becomes a firm-pointer baseline: the 214-to-7 pair is the upload route).
 */
const VARIANCE_DIR = join(ROOT, 'fixtures', 'variance', 'hartwell-crane');
const VARIANCE_DEMO: { id: string; file: string; title: string; fund: string; version: string }[] =
  [
    {
      id: 'vh-fund-I',
      file: 'fund-I.html',
      title: 'Hartwell & Crane Fund I (variance demo)',
      fund: 'Fund I',
      version: 'v1',
    },
    {
      id: 'vh-fund-II',
      file: 'fund-II.html',
      title: 'Hartwell & Crane Fund II (variance demo)',
      fund: 'Fund II',
      version: 'v1',
    },
    {
      id: 'vh-fund-III',
      file: 'fund-III.html',
      title: 'Hartwell & Crane Fund III (variance demo)',
      fund: 'Fund III',
      version: 'v1',
    },
    {
      id: 'vh-fund-III-appendix-c',
      file: 'fund-III-with-appendix-c.html',
      title: 'Hartwell & Crane Fund III with Appendix C (variance demo)',
      fund: 'Fund III',
      version: 'with Appendix C',
    },
  ];
const ORIGINAL_HTML = 12;

function fail(msg: string): never {
  console.error(`build-samples: ${msg}`);
  process.exit(1);
}

export function buildSamples(): SampleEntry[] {
  if (!existsSync(RAW)) fail(`missing sample directory ${RAW}`);
  if (!existsSync(FIRMS_SRC))
    fail(`missing ${FIRMS_SRC} (Phase 01 creates it); refusing to emit an empty firms.json`);
  const firms = JSON.parse(readFileSync(FIRMS_SRC, 'utf8')) as { firms?: unknown };
  if (!Array.isArray(firms.firms) || firms.firms.length === 0) fail(`${FIRMS_SRC} has no firms`);

  mkdirSync(OUT_SAMPLES, { recursive: true });
  const files = readdirSync(RAW);
  const entries: SampleEntry[] = [];
  for (const id of Object.keys(TAGS).sort()) {
    const tag = TAGS[id]!;
    if (id === '09') {
      const dir = files.find((f) => f.startsWith('09-'));
      if (!dir) fail('missing scan set 09-*');
      // Phase 06f: downscaled page images + per-page original-bytes hash (OCR cache key)
      const set = buildScanSet();
      if (set.pages.length !== 22) fail(`expected 22 scan pages, found ${set.pages.length}`);
      entries.push({
        id,
        file: null,
        ...tag,
        kind: 'scan',
        disabled: false,
        pages: set.pages.map((p) => ({
          n: p.n,
          file: `${SCAN_URL_PREFIX}/${p.file}`,
          sourceHash: p.sourceHash,
        })),
        note: 'Scanned pages, read by OCR',
      });
      continue;
    }
    if (!HTML_IDS.includes(id)) continue;
    const file = files.find((f) => f.startsWith(`${id}-`) && f.endsWith('.htm'));
    if (!file) fail(`missing HTML sample ${id}-*.htm`);
    copyFileSync(join(RAW, file), join(OUT_SAMPLES, file));
    entries.push({ id, file, ...tag, kind: 'html', disabled: false });
  }
  if (entries.filter((e) => e.kind === 'html').length !== ORIGINAL_HTML)
    fail(`expected ${ORIGINAL_HTML} HTML samples`);
  for (const v of VARIANCE_DEMO) {
    const from = join(VARIANCE_DIR, v.file);
    if (!existsSync(from)) fail(`missing variance demo document ${v.file}`);
    const file = `hartwell-crane-${v.file}`;
    copyFileSync(from, join(OUT_SAMPLES, file));
    entries.push({
      id: v.id,
      file,
      title: v.title,
      firmId: 'hartwell-crane',
      fund: v.fund,
      version: v.version,
      kind: 'html',
      disabled: false,
    });
  }
  // explicit guard: 12 original HTML samples + N variance-demo documents (never a range)
  if (entries.filter((e) => e.kind === 'html').length !== ORIGINAL_HTML + VARIANCE_DEMO.length)
    fail(`expected ${ORIGINAL_HTML} + ${VARIANCE_DEMO.length} HTML samples`);
  writeFileSync(
    join(OUT_SAMPLES, 'manifest.json'),
    JSON.stringify({ version: 1, samples: entries }, null, 2) + '\n',
  );
  writeFileSync(join(OUT, 'firms.json'), JSON.stringify(firms, null, 2) + '\n');
  buildPackages(entries);
  return entries;
}

/**
 * Intake Phase 2 (F5/F5b): copy demo package member files to public/samples/packages/<id>/ and
 * write public/samples/packages.json (design packages first). A missing demo-packages.json warns
 * and writes an empty list; manifest.json is never touched here.
 */
export function buildPackages(samples: readonly SampleEntry[]): DemoPackageEntry[] {
  const out: DemoPackageEntry[] = [];
  const write = () =>
    writeFileSync(
      join(OUT_SAMPLES, 'packages.json'),
      JSON.stringify({ version: 1, packages: out }, null, 2) + '\n',
    );
  if (!existsSync(PKG_SRC)) {
    console.warn(`build-samples: ${PKG_SRC} missing; writing an empty packages.json`);
    write();
    return out;
  }
  const src = JSON.parse(readFileSync(PKG_SRC, 'utf8')) as {
    packages?: { id: string; firmId: string | null; members: string[] }[];
  };
  const list = Array.isArray(src.packages) ? src.packages : [];
  const design = (p: { members: string[] }) => p.members.some((m) => m.startsWith(DESIGN_PREFIX));
  const ordered = [...list.filter(design), ...list.filter((p) => !design(p))];
  for (const p of ordered) {
    if (!/^[a-z0-9-]{1,40}$/.test(p.id)) continue;
    const members: DemoPackageMember[] = [];
    for (const m of p.members) {
      const ref = /^(sample|scan):(\d{2})$/.exec(m);
      if (ref) {
        if (!samples.some((s) => s.id === ref[2])) continue;
        members.push({ kind: ref[1] as 'sample' | 'scan', sampleId: ref[2]! });
        continue;
      }
      const from = join(ROOT, m);
      if (!existsSync(from)) {
        console.warn(`build-samples: demo package member missing: ${m}`);
        continue;
      }
      const name = m.split('/').pop()!;
      mkdirSync(join(OUT_PACKAGES, p.id), { recursive: true });
      copyFileSync(from, join(OUT_PACKAGES, p.id, name));
      members.push({ kind: 'file', name, url: `/samples/packages/${p.id}/${name}` });
    }
    if (!members.length) continue;
    const tag = PACKAGE_TAGS[p.id] ?? { title: p.id, fund: p.id, version: 'v1' };
    out.push({
      id: p.id,
      title: tag.title,
      firmId: p.firmId ?? null,
      fund: tag.fund,
      version: tag.version,
      members,
    });
  }
  write();
  return out;
}

const entries = buildSamples();
console.log(
  `build-samples: ${entries.length} entries (${entries.filter((e) => !e.disabled).length} enabled) -> apps/web/public`,
);
