import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Paths never scanned (guard sources hold the forbidden patterns by design). */
const EXCLUDED = [
  /^scripts\/src\/guards\//,
  /^scripts\/(.*\/)?test\//,
  /^process\//,
  /^docs\//,
  /^CLAUDE\.md$/,
  /^AGENTS\.md$/,
];

const ROOT_CONFIG = /^[^/]+\.(json|jsonc|ya?ml|js|mjs|cjs|ts|toml)$|^\.[^/]+rc(\.json)?$|^\.nvmrc$/;

export function isWranglerConfig(path: string): boolean {
  return /(^|\/)wrangler\.(jsonc?|toml)$/.test(path);
}

export function inScope(path: string): boolean {
  if (EXCLUDED.some((re) => re.test(path))) return false;
  return (
    isWranglerConfig(path) ||
    /(^|\/)package\.json$/.test(path) ||
    path.startsWith('scripts/') ||
    /^apps\/[^/]+\/src\//.test(path) ||
    ROOT_CONFIG.test(path)
  );
}

/** Tracked + untracked-not-ignored files (so new uncommitted files are scanned). */
export function listFiles(root: string): string[] {
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return out.split('\n').filter(Boolean);
}

export interface Finding {
  file: string;
  line: number;
  rule: string;
}

export function readText(root: string, file: string): string | null {
  try {
    const buf = readFileSync(join(root, file));
    if (buf.includes(0)) return null; // binary
    return buf.toString('utf8');
  } catch {
    return null; // deleted in worktree but still in index
  }
}

export function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

export function report(name: string, findings: Finding[]): number {
  if (findings.length === 0) {
    console.log(`${name}: OK`);
    return 0;
  }
  // Report location and rule only; never print the matched value (may be a secret).
  for (const f of findings) console.error(`${name}: ${f.file}:${f.line} ${f.rule}`);
  console.error(`${name}: FAILED (${findings.length} finding(s))`);
  return 1;
}
