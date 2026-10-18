import { pathToFileURL } from 'node:url';
import {
  type Finding,
  inScope,
  isWranglerConfig,
  lineOf,
  listFiles,
  readText,
  report,
} from './scan-files';

// Assembled so this source never contains the literal values it guards against.
const ZONE_ID = ['894bc9f9', '3640fab2', '60bf1580', 'b5b48cb7'].join('');
const ZONE_NAME = ['itsjiathao', 'com'].join('.');
const PREFIX = 'aduin-transaction';
/** The only allowed zone-name occurrence: the author website link in the root README. */
const README_AUTHOR_LINK = `https://${ZONE_NAME}/`;

function isAllowedZoneName(file: string, text: string, index: number): boolean {
  if (file !== 'README.md') return false;
  const start = index - 'https://'.length;
  return start >= 0 && text.slice(start, start + README_AUTHOR_LINK.length) === README_AUTHOR_LINK;
}

/** Keys whose string value names a Cloudflare resource (Worker, D1, KV, R2, queue). */
const NAME_KEYS = ['name', 'database_name', 'bucket_name', 'queue', 'service', 'script_name'];

export function scanText(file: string, text: string): Finding[] {
  const findings: Finding[] = [];
  const add = (index: number, rule: string) =>
    findings.push({ file, line: lineOf(text, index), rule });

  for (const [needle, rule] of [
    [ZONE_ID, 'zone-id'],
    [ZONE_NAME, 'zone-name'],
  ] as const) {
    let i = text.toLowerCase().indexOf(needle);
    while (i !== -1) {
      if (!(rule === 'zone-name' && isAllowedZoneName(file, text, i))) add(i, rule);
      i = text.toLowerCase().indexOf(needle, i + 1);
    }
  }

  if (isWranglerConfig(file)) {
    for (const m of text.matchAll(
      /["']?\b(routes|route|custom_domain|zone_id|zone_name)\b["']?\s*[:=]/g,
    )) {
      add(m.index ?? 0, `wrangler-${m[1]}-key`);
    }
    const keyRe = new RegExp(
      `["']?\\b(${NAME_KEYS.join('|')})\\b["']?\\s*[:=]\\s*["']([^"']*)["']`,
      'g',
    );
    for (const m of text.matchAll(keyRe)) {
      const value = m[2] ?? '';
      if (!value.startsWith(PREFIX)) add(m.index ?? 0, `unprefixed-${m[1]}`);
    }
  }
  return findings;
}

export function guardCf(root: string): Finding[] {
  return listFiles(root)
    .filter(inScope)
    .flatMap((file) => {
      const text = readText(root, file);
      return text === null ? [] : scanText(file, text);
    });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = process.argv[2] ?? process.cwd().replace(/\/scripts$/, '');
  process.exit(report('guard:cf', guardCf(root)));
}
