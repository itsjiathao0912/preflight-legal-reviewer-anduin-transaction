// F7: MEMORY_LABELS equals the applied finding.memory_label CHECK list (no core test edit).
import { env } from 'cloudflare:test';
import {
  AnswerScopeSchema,
  MEMORY_LABELS,
  OwnerSourceSchema,
  QuestionOwnerSchema,
} from '@aduin/core';
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

  test('variance 0006: owner / owner_source / scope enums equal the applied CHECK lists', async () => {
    const sqlOf = async (t: string) =>
      (
        await env.DB.prepare('SELECT sql FROM sqlite_master WHERE name = ?1').bind(t).first<{
          sql: string;
        }>()
      )?.sql ?? '';
    const list = (sql: string, col: string) => {
      const m = new RegExp(`${col} IN \\(([^)]*)\\)`).exec(sql);
      return m ? [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]).sort() : null;
    };
    const q = await sqlOf('counsel_question');
    expect(list(q, 'owner')).toEqual([...QuestionOwnerSchema.options].sort());
    expect(list(q, 'owner_source')).toEqual([...OwnerSourceSchema.options].sort());
    for (const t of ['counsel_answer', 'decision'])
      expect(list(await sqlOf(t), 'scope'), t).toEqual([...AnswerScopeSchema.options].sort());
  });
});
