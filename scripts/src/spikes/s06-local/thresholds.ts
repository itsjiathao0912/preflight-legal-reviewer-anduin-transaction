import type { SpikeVerdict } from '../s07-browser-timing/thresholds';

export const MiB = 1024 * 1024;
export const S6_LIMITS = { passBytes: 1 * MiB, killBytes: 2.5 * MiB } as const;

/** S6 local verdict on the gzipped Worker bundle size. */
export function judgeS6Size(gzBytes: number): SpikeVerdict {
  if (gzBytes > S6_LIMITS.killBytes) return 'FAIL';
  if (gzBytes >= S6_LIMITS.passBytes) return 'PASS-WITH-RISK';
  return 'PASS';
}
