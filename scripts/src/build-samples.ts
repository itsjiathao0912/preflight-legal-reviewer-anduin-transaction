/**
 * build-samples: copies the public HTML sample corpus into apps/web/public/samples/ and writes
 * manifest.json (firm / fund / version tags) plus apps/web/public/firms.json.
 *
 * Single samples mechanism for @aduin/web (Phase 03): run by the prebuild / prebuild:e2e / predev /
 * pretest:e2e / pretest:a11y scripts. Idempotent. Output is gitignored.
 *
 * Corpus (D-7): 12 HTML samples (01-08, 10-13) plus the 22-page scan set #9, listed as disabled until
 * Phase 06. #14 (ILPA, local-only) is never copied.
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

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = join(ROOT, 'samples', 'sub-docs', 'raw');
const FIRMS_SRC = join(ROOT, 'fixtures', 'memory', 'law-firms.json');
const OUT = join(ROOT, 'apps', 'web', 'public');
const OUT_SAMPLES = join(OUT, 'samples');

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
      entries.push({
        id,
        file: null,
        ...tag,
        kind: 'scan',
        disabled: true,
        pages: 22,
        note: 'Scanned pages: supported in a later build',
      });
      continue;
    }
    if (!HTML_IDS.includes(id)) continue;
    const file = files.find((f) => f.startsWith(`${id}-`) && f.endsWith('.htm'));
    if (!file) fail(`missing HTML sample ${id}-*.htm`);
    copyFileSync(join(RAW, file), join(OUT_SAMPLES, file));
    entries.push({ id, file, ...tag, kind: 'html', disabled: false });
  }
  if (entries.filter((e) => e.kind === 'html').length !== 12) fail('expected 12 HTML samples');
  writeFileSync(
    join(OUT_SAMPLES, 'manifest.json'),
    JSON.stringify({ version: 1, samples: entries }, null, 2) + '\n',
  );
  writeFileSync(join(OUT, 'firms.json'), JSON.stringify(firms, null, 2) + '\n');
  return entries;
}

const entries = buildSamples();
console.log(
  `build-samples: ${entries.length} entries (${entries.filter((e) => !e.disabled).length} enabled) -> apps/web/public`,
);
