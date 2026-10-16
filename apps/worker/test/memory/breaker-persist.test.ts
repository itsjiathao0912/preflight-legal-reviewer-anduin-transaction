// F14: BreakerPort persisted on app_meta: a trip is visible to every isolate; the in-isolate trip
// is set FIRST (a failed write still trips); a read failure throws (the pipeline fails closed).
import { env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { createD1Breaker } from '../../src/platform/breaker';

const failing = (mode: 'write' | 'read') =>
  ({
    prepare(sql: string) {
      const isWrite = sql.startsWith('INSERT');
      const real = env.DB.prepare(sql);
      return {
        bind: (...v: unknown[]) => {
          const b = real.bind(...v);
          return {
            first: () =>
              mode === 'read' && !isWrite ? Promise.reject(new Error('D1 read down')) : b.first(),
            run: () =>
              mode === 'write' && isWrite ? Promise.reject(new Error('D1 write down')) : b.run(),
          };
        },
      };
    },
  }) as unknown as D1Database;

describe('breaker-persist (F14)', () => {
  test('a trip persists across port instances (isolates) for the same day and fingerprint only', async () => {
    const a = createD1Breaker(env.DB);
    expect(await a.tripped('2026-10-17', 'fp1')).toBe(false);
    await a.trip('2026-10-17', 'fp1');
    const b = createD1Breaker(env.DB); // a fresh isolate
    expect(await b.tripped('2026-10-17', 'fp1')).toBe(true);
    expect(await b.tripped('2026-10-18', 'fp1')).toBe(false);
    expect(await b.tripped('2026-10-17', 'fp2')).toBe(false);
  });

  test('should keep a breaker trip when the persisted write fails', async () => {
    const p = createD1Breaker(failing('write'));
    await expect(p.trip('2026-10-19', 'fpx')).rejects.toThrow(/write down/);
    expect(await p.tripped('2026-10-19', 'fpx')).toBe(true); // in-isolate trip set first
    expect(await createD1Breaker(env.DB).tripped('2026-10-19', 'fpx')).toBe(false); // not persisted
  });

  test('tripped() throws on a read failure (the pipeline treats it as tripped)', async () => {
    await expect(createD1Breaker(failing('read')).tripped('2026-10-20', 'fp')).rejects.toThrow(
      /read down/,
    );
  });
});
