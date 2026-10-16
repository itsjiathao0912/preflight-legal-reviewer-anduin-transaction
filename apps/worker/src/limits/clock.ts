// UTC-day windows. All quota windows reset at UTC midnight.

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` of the UTC day containing `nowMs`. */
export function utcDay(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/** Epoch seconds of the next UTC midnight after `nowMs`. */
export function nextUtcMidnightS(nowMs: number): number {
  return Math.floor(((Math.floor(nowMs / DAY_MS) + 1) * DAY_MS) / 1000);
}

/** Seconds until the next UTC midnight (>= 1). */
export function secondsToReset(nowMs: number): number {
  return Math.max(1, nextUtcMidnightS(nowMs) - Math.floor(nowMs / 1000));
}
