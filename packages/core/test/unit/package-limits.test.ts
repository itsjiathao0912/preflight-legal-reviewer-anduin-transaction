import { describe, expect, it } from 'vitest';
import { limits } from '../../src/config/limits';
import { checkPackageLimits, PACKAGE_LIMITS } from '../../src/package/index';

const MB = 1024 * 1024;
const files = (n: number, size = 1) =>
  Array.from({ length: n }, (_, i) => ({ name: `f${i}.pdf`, size }));

describe('package-limits (AC-I1 core half)', () => {
  it('pins 12 files, 40 MB total and the frozen per-file upload limit', () => {
    expect(PACKAGE_LIMITS).toEqual({
      maxFiles: 12,
      maxTotalBytes: 40 * MB,
      maxFileBytes: limits.maxUploadBytes,
    });
  });

  it('accepts exactly 12 files and exactly 40 MB', () => {
    expect(checkPackageLimits(files(12))).toEqual({ ok: true });
    expect(checkPackageLimits(files(4, 10 * MB))).toEqual({ ok: true });
  });

  it('refuses 13 files with the plain-language message', () => {
    expect(checkPackageLimits(files(13))).toEqual({
      ok: false,
      message: 'A package takes up to 12 files and 40 MB in total. You chose 13 files.',
    });
  });

  it('refuses a file over the per-file limit, naming it', () => {
    const r = checkPackageLimits([{ name: 'big.pdf', size: limits.maxUploadBytes + 1 }]);
    expect(r).toEqual({ ok: false, message: 'Each file can be up to 10 MB. "big.pdf" is larger.' });
  });

  it('refuses a total over 40 MB', () => {
    const r = checkPackageLimits([...files(4, 10 * MB), { name: 'x', size: 1 }]);
    expect(r.ok).toBe(false);
    expect(r.ok ? '' : r.message).toBe(
      'A package takes up to 12 files and 40 MB in total. These files add up to 40.0 MB.',
    );
  });

  it('has no side effects on its input', () => {
    const input = files(13);
    const copy = JSON.stringify(input);
    checkPackageLimits(input);
    expect(JSON.stringify(input)).toBe(copy);
  });
});
