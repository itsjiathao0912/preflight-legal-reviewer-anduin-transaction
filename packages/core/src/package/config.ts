import { limits } from '../config/limits';

/** Package upload limits (intake). The frozen `limits` object is read, never changed. */
export const PACKAGE_LIMITS = Object.freeze({
  maxFiles: 12,
  maxTotalBytes: 40 * 1024 * 1024,
  maxFileBytes: limits.maxUploadBytes,
});

export type PackageLimitResult = { ok: true } | { ok: false; message: string };

/** Pure refusal rule: stores nothing, returns a plain-language message. */
export function checkPackageLimits(
  files: ReadonlyArray<{ name: string; size: number }>,
): PackageLimitResult {
  if (files.length > PACKAGE_LIMITS.maxFiles)
    return {
      ok: false,
      message: `A package takes up to 12 files and 40 MB in total. You chose ${files.length} files.`,
    };
  const big = files.find((f) => f.size > PACKAGE_LIMITS.maxFileBytes);
  if (big)
    return {
      ok: false,
      message: `Each file can be up to ${PACKAGE_LIMITS.maxFileBytes / (1024 * 1024)} MB. "${big.name.slice(0, 120)}" is larger.`,
    };
  const total = files.reduce((n, f) => n + f.size, 0);
  if (total > PACKAGE_LIMITS.maxTotalBytes)
    return {
      ok: false,
      message: `A package takes up to 12 files and 40 MB in total. These files add up to ${(total / (1024 * 1024)).toFixed(1)} MB.`,
    };
  return { ok: true };
}
