import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** Creates a throwaway git repo in the OS tmp dir with the given files (built at runtime). */
export function tmpRepo(files: Record<string, string>): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), 'aduin-guard-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
