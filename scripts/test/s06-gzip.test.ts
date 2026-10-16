import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gzipSizeOf } from '../src/spikes/s06-local/run';
import { judgeS6Size } from '../src/spikes/s06-local/thresholds';

describe('spike:s06-local gzip measurement', () => {
  it('flags an oversized (incompressible) bundle as a kill', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aduin-s06-test-'));
    try {
      writeFileSync(join(dir, 'index.js'), randomBytes(3 * 1024 * 1024));
      writeFileSync(join(dir, 'index.js.map'), randomBytes(1024));
      const size = gzipSizeOf(dir);
      expect(size.files).toBe(1);
      expect(judgeS6Size(size.gzBytes)).toBe('FAIL');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
