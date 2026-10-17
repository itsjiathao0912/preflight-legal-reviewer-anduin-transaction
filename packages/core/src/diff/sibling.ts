import { diffArrays } from 'diff';
import type { Structure } from '../structure/types';
import type { Unit } from './align';
import { blockText } from './align';
import { diffText, excerptOf, MAX_EDIT_LENGTH } from './diff-text';
import { normText } from './normalize-key';
import type { Clause } from './types';

/**
 * Sibling mode (Omnibus practice): every clause (block) is labeled common / differing / only_a /
 * only_b. "common" means identical after normalization — a textual label, never a claim of legal
 * equivalence. Inside an aligned unit pair the blocks are aligned with jsdiff on normalized text;
 * a removed run directly followed by an added run pairs up positionally as "differing".
 */
export function labelClauses(
  sa: Structure,
  sb: Structure,
  unitsA: readonly Unit[],
  unitsB: readonly Unit[],
  pairs: ReadonlyArray<readonly [number, number]>,
  onlyA: readonly number[],
  onlyB: readonly number[],
): Clause[] {
  const out: Clause[] = [];
  const ex = (s: Structure, bi: number) => excerptOf(blockText(s, bi), 0, 260, 0);
  const only = (label: 'only_a' | 'only_b', s: Structure, u: Unit) => {
    for (const bi of u.blockIndices)
      out.push({
        label,
        ...(label === 'only_a' ? { pathA: u.path, a: ex(s, bi) } : { pathB: u.path, b: ex(s, bi) }),
        truncated: false,
      });
  };
  const pendingA = new Set(onlyA);
  for (const [ia, ib] of pairs) {
    // old-only units that precede this pair in old order are emitted before it
    for (const x of [...pendingA].sort((p, q) => p - q)) {
      if (x > ia) break;
      only('only_a', sa, unitsA[x]!);
      pendingA.delete(x);
    }
    const ua = unitsA[ia]!;
    const ub = unitsB[ib]!;
    const na = ua.blockIndices.map((bi) => normText(blockText(sa, bi)));
    const nb = ub.blockIndices.map((bi) => normText(blockText(sb, bi)));
    const changes = diffArrays(na, nb, { maxEditLength: MAX_EDIT_LENGTH }) ?? [
      { count: na.length, removed: true, added: false, value: na },
      { count: nb.length, removed: false, added: true, value: nb },
    ];
    let x = 0;
    let y = 0;
    for (let k = 0; k < changes.length; k++) {
      const c = changes[k]!;
      const n = c.count ?? c.value.length;
      if (!c.added && !c.removed) {
        for (let t = 0; t < n; t++)
          out.push({
            label: 'common',
            pathA: ua.path,
            pathB: ub.path,
            a: ex(sa, ua.blockIndices[x + t]!),
            b: ex(sb, ub.blockIndices[y + t]!),
            truncated: false,
          });
        x += n;
        y += n;
        continue;
      }
      if (c.removed) {
        const next = changes[k + 1];
        const m = next?.added ? (next.count ?? next.value.length) : 0;
        const pair = Math.min(n, m);
        for (let t = 0; t < pair; t++) {
          const ta = blockText(sa, ua.blockIndices[x + t]!);
          const tb = blockText(sb, ub.blockIndices[y + t]!);
          const d = diffText(ta, tb);
          out.push({
            label: 'differing',
            pathA: ua.path,
            pathB: ub.path,
            a: excerptOf(ta, 0, 260, 0),
            b: excerptOf(tb, 0, 260, 0),
            segments: d.segments,
            truncated: d.truncated,
          });
        }
        for (let t = pair; t < n; t++)
          out.push({
            label: 'only_a',
            pathA: ua.path,
            a: ex(sa, ua.blockIndices[x + t]!),
            truncated: false,
          });
        for (let t = pair; t < m; t++)
          out.push({
            label: 'only_b',
            pathB: ub.path,
            b: ex(sb, ub.blockIndices[y + t]!),
            truncated: false,
          });
        x += n;
        y += m;
        if (m) k++;
        continue;
      }
      for (let t = 0; t < n; t++) {
        out.push({
          label: 'only_b',
          pathB: ub.path,
          b: ex(sb, ub.blockIndices[y + t]!),
          truncated: false,
        });
      }
      y += n;
    }
  }
  for (const x of [...pendingA].sort((p, q) => p - q)) only('only_a', sa, unitsA[x]!);
  for (const j of onlyB) only('only_b', sb, unitsB[j]!);
  return out;
}
