// Spend ledger for the defect bench live run (llm-defect-detection, AC12). Separate from the live
// `Ledger` in live/common.ts (which counts calls only): this one tracks USD per call.
//
// - file `bench-spend-ledger.json` under defaultScratchDir(), refused inside the repo, mode 600,
//   written atomically (tmp + rename);
// - every call is CLAIMED with its worst-case cost BEFORE it is sent, then settled with the real
//   usage (or kept at worst case when no usage came back);
// - refuses when lifetime spend + the next worst case would pass the $10 cap, when the per-run call
//   ceiling is reached, or when the per-run budget (--max-usd) would be passed.
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { assertOutsideRepo, defaultScratchDir } from '../live/common';

export const LIFETIME_CAP_MICRO_USD = 10_000_000; // $10
export const DEFAULT_MAX_CALLS = 20;
export const DEFAULT_MAX_USD = 1.0;

export class BenchRefusal extends Error {}

export interface BenchLedgerEntry {
  label: string;
  doc: string;
  at: string;
  /** worst-case claim until settled, then the real cost */
  costMicroUsd: number;
  tokensIn?: number;
  tokensOut?: number;
  settled: boolean;
}

export interface BenchLedgerState {
  version: 1;
  entries: BenchLedgerEntry[];
}

/** Storage seam so tests never touch the file system. */
export interface BenchLedgerStore {
  read(): BenchLedgerState;
  write(s: BenchLedgerState): void;
}

export function fileStore(dir = defaultScratchDir()): BenchLedgerStore & { file: string } {
  const file = join(assertOutsideRepo(dir), 'bench-spend-ledger.json');
  return {
    file,
    read() {
      if (!existsSync(file)) return { version: 1, entries: [] };
      const s = JSON.parse(readFileSync(file, 'utf8')) as BenchLedgerState;
      if (s.version !== 1 || !Array.isArray(s.entries))
        throw new BenchRefusal('bench ledger file is malformed');
      return s;
    },
    write(s) {
      if (!existsSync(dirname(file))) mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
      const tmp = `${file}.tmp-${process.pid}`;
      writeFileSync(tmp, JSON.stringify(s, null, 2), { mode: 0o600 });
      chmodSync(tmp, 0o600);
      renameSync(tmp, file);
    },
  };
}

export interface BenchLimits {
  maxCalls: number;
  maxMicroUsd: number;
}

/** --max-calls may only LOWER the default ceiling unless `allowAbove` (explicit all-docs run). */
export function benchLimits(
  maxCallsFlag: string | undefined,
  maxUsdFlag: string | undefined,
  allowAbove = false,
): BenchLimits {
  let maxCalls = DEFAULT_MAX_CALLS;
  if (maxCallsFlag !== undefined) {
    const n = Number(maxCallsFlag);
    if (!Number.isInteger(n) || n < 1)
      throw new BenchRefusal('--max-calls must be a positive integer');
    if (n > DEFAULT_MAX_CALLS && !allowAbove)
      throw new BenchRefusal(`--max-calls may only lower the ceiling of ${DEFAULT_MAX_CALLS}`);
    maxCalls = n;
  }
  let maxUsd = DEFAULT_MAX_USD;
  if (maxUsdFlag !== undefined) {
    const n = Number(maxUsdFlag);
    if (!Number.isFinite(n) || n <= 0)
      throw new BenchRefusal('--max-usd must be a positive number');
    maxUsd = n;
  }
  return { maxCalls, maxMicroUsd: Math.round(maxUsd * 1_000_000) };
}

export class BenchLedger {
  private runCalls = 0;
  private runMicroUsd = 0;
  private readonly runIdx: number[] = [];

  constructor(
    private readonly store: BenchLedgerStore,
    private readonly limits: BenchLimits,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  lifetimeMicroUsd(): number {
    return this.store.read().entries.reduce((a, e) => a + e.costMicroUsd, 0);
  }

  runSpentMicroUsd(): number {
    return this.runMicroUsd;
  }

  /** Claim one call at its worst-case cost or throw BenchRefusal. Returns the entry handle. */
  claim(label: string, doc: string, worstMicroUsd: number): number {
    if (this.runCalls >= this.limits.maxCalls)
      throw new BenchRefusal(`per-run call ceiling of ${this.limits.maxCalls} reached`);
    if (this.runMicroUsd + worstMicroUsd > this.limits.maxMicroUsd)
      throw new BenchRefusal(
        `per-run budget of $${(this.limits.maxMicroUsd / 1e6).toFixed(2)} would be passed; ` +
          'ask the user before raising --max-usd',
      );
    const s = this.store.read();
    const life = s.entries.reduce((a, e) => a + e.costMicroUsd, 0);
    if (life + worstMicroUsd > LIFETIME_CAP_MICRO_USD)
      throw new BenchRefusal('lifetime bench spend would pass the $10 cap');
    s.entries.push({
      label,
      doc,
      at: this.clock().toISOString(),
      costMicroUsd: worstMicroUsd,
      settled: false,
    });
    this.store.write(s);
    this.runCalls++;
    this.runMicroUsd += worstMicroUsd;
    this.runIdx.push(s.entries.length - 1);
    return s.entries.length - 1;
  }

  /** Settle a claim with the real usage (cost in µUSD). */
  settle(handle: number, costMicroUsd: number, tokensIn: number, tokensOut: number): void {
    const s = this.store.read();
    const e = s.entries[handle];
    if (!e) return;
    this.runMicroUsd += costMicroUsd - e.costMicroUsd;
    e.costMicroUsd = costMicroUsd;
    e.tokensIn = tokensIn;
    e.tokensOut = tokensOut;
    e.settled = true;
    this.store.write(s);
  }
}
