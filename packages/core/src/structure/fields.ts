import { sha256Hex } from '../model/hash';
import type { Block } from '../model/types';
import type { Field } from './types';

/** Fields: fill-in blanks ("____"), "Label:" lines and "$" amount lines (short, no sentence). */
export function fieldLabels(text: string): string[] {
  const out: string[] = [];
  const t = text.trim();
  for (const m of t.matchAll(/([A-Z][A-Za-z#/()' -]{1,60}?)\s*:?\s*_{3,}/g)) out.push(m[1]!.trim());
  if (out.length === 0 && t.length <= 80 && /^[A-Z][^.!?]{1,78}(:|\$)$/.test(t))
    out.push(t.replace(/[\s:$]+$/, '').trim());
  return out;
}

export function extractFields(blocks: Block[]): Field[] {
  const out: Field[] = [];
  blocks.forEach((b, bi) => {
    const text = b.lines.map((l) => l.text).join(' ');
    for (const label of fieldLabels(text)) {
      out.push({ id: 'fld_' + sha256Hex(`${b.id}|${label}`).slice(0, 16), label, blockIndex: bi });
    }
  });
  return out;
}
