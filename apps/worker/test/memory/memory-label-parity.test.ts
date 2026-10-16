// F7: MEMORY_LABELS equals the applied finding.memory_label CHECK list (no core test edit).
import { env } from 'cloudflare:test';
import { MEMORY_LABELS } from '@aduin/core';
import { describe, expect, test } from 'vitest';

describe('memory-label-parity (F7)', () => {
  test('MEMORY_LABELS equals the applied CHECK list', async () => {
    const row = await env.DB.prepare("SELECT sql FROM sqlite_master WHERE name = 'finding'").first<{
      sql: string;
    }>();
    const m = /memory_label IN\s*\(([^)]*)\)/.exec(row?.sql ?? '');
    expect(m).not.toBeNull();
    const labels = [...m![1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]);
    expect([...labels].sort()).toEqual([...MEMORY_LABELS].sort());
  });
});
