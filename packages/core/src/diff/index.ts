import { CoreError } from '../model/errors';
import type { Structure } from '../structure/types';
import { alignUnits, blockText, buildUnits, headedUnitCount, type Unit } from './align';
import { diffText, excerptOf, wholeSegments, type TokenDiffPart } from './diff-text';
import { diffFees, feeMentions } from './extract-fees';
import { diffRequirements, type BlockRef } from './extract-requirements';
import { diffDefinitions, termDefs } from './extract-terms';
import { findingsDelta } from './findings-delta';
import { inferRenames, possibleLeftovers, type AlignedText } from './rename-inference';
import { labelClauses } from './sibling';
import {
  DIFF_STAGES,
  type DiffError,
  type DiffInput,
  type DiffMode,
  type DiffOutcome,
  type DiffResult,
  type DiffSide,
  type DiffStage,
  type SectionDiff,
  type SectionStatus,
  type SideInput,
} from './types';

const CODE_RE = /^[a-z_]{1,40}$/;

/** Validate one side at the boundary; a failed or malformed side becomes a code-only error. */
function sideError(side: DiffSide, s: SideInput | undefined): DiffError | undefined {
  if (!s || typeof s !== 'object') return { side, stage: 'read', code: 'invalid_request' };
  if (s.ok === false) {
    const stage: DiffStage = (DIFF_STAGES as readonly string[]).includes(s.stage)
      ? s.stage
      : 'read';
    const code = typeof s.code === 'string' && CODE_RE.test(s.code) ? s.code : 'unknown';
    return { side, stage, code };
  }
  if (
    s.ok !== true ||
    !s.structure ||
    !Array.isArray(s.structure.blocks) ||
    !Array.isArray(s.findings)
  )
    return { side, stage: 'read', code: 'invalid_request' };
  return undefined;
}

function unitIndexOfBlocks(s: Structure, units: readonly Unit[]): number[] {
  const out = new Array<number>(s.blocks.length);
  for (const u of units) for (const bi of u.blockIndices) out[bi] = u.index;
  return out;
}

function blockRefs(s: Structure, units: readonly Unit[]): BlockRef[] {
  return units.flatMap((u) => u.blockIndices.map((bi) => ({ unit: u, text: blockText(s, bi) })));
}

const unitExcerpt = (u: Unit) => excerptOf(u.text, 0, 220, 0);

function compute(
  sa: Structure,
  sb: Structure,
  fa: SideInput & { ok: true },
  fb: SideInput & { ok: true },
  mode: DiffMode,
): DiffResult {
  const A = buildUnits(sa);
  const B = buildUnits(sb);
  const uobA = unitIndexOfBlocks(sa, A);
  const uobB = unitIndexOfBlocks(sb, B);
  const al = alignUnits(A, B);

  const aligned: AlignedText[] = [];
  const pairEntry = new Map<number, SectionDiff>();
  for (const [ia, ib] of al.pairs) {
    const ua = A[ia]!;
    const ub = B[ib]!;
    let status: SectionStatus;
    if (ua.headKey !== ub.headKey) status = 'renamed';
    else if (ua.key !== ub.key || al.outOfOrder.has(ia)) status = 'moved';
    else status = ua.norm === ub.norm ? 'same' : 'changed';
    const entry: SectionDiff = {
      status,
      kind: ub.kind,
      keyA: ua.key,
      keyB: ub.key,
      pathA: ua.path,
      pathB: ub.path,
      titleA: ua.title,
      titleB: ub.title,
      truncated: false,
    };
    let parts: TokenDiffPart[] | undefined;
    if (ua.norm !== ub.norm) {
      const d = diffText(ua.text, ub.text);
      parts = d.parts;
      entry.segments = d.segments;
      entry.truncated = d.truncated;
      entry.a = unitExcerpt(ua);
      entry.b = unitExcerpt(ub);
    }
    aligned.push({ a: ua, b: ub, parts });
    pairEntry.set(ib, entry);
  }

  // document order: new-document order, old-only units placed before the first pair after them
  const sections: SectionDiff[] = [];
  const pendingA = [...al.onlyA];
  const partnerOfB = new Map(al.pairs.map(([ia, ib]) => [ib, ia] as const));
  const removed = (u: Unit): SectionDiff => ({
    status: 'removed',
    kind: u.kind,
    keyA: u.key,
    pathA: u.path,
    titleA: u.title,
    a: unitExcerpt(u),
    segments: wholeSegments('del', u.text),
    truncated: false,
  });
  B.forEach((ub, ib) => {
    const ia = partnerOfB.get(ib);
    if (ia === undefined) {
      sections.push({
        status: 'added',
        kind: ub.kind,
        keyB: ub.key,
        pathB: ub.path,
        titleB: ub.title,
        b: unitExcerpt(ub),
        segments: wholeSegments('add', ub.text),
        truncated: false,
      });
      return;
    }
    while (pendingA.length && pendingA[0]! < ia) sections.push(removed(A[pendingA.shift()!]!));
    sections.push(pairEntry.get(ib)!);
  });
  for (const ia of pendingA) sections.push(removed(A[ia]!));

  const renames = mode === 'version' ? inferRenames(aligned) : [];
  const defsA = termDefs(sa, uobA, A);
  const defsB = termDefs(sb, uobB, B);
  const possible = possibleLeftovers(
    defsA.map((d) => d.term),
    renames,
    A,
    B,
  );
  const refsA = blockRefs(sa, A);
  const refsB = blockRefs(sb, B);
  const definitions = diffDefinitions(defsA, defsB, renames);
  const requirements = diffRequirements(refsA, refsB, renames);
  const fees = diffFees(feeMentions(refsA), feeMentions(refsB));
  const delta = findingsDelta(
    { findings: fa.findings, structure: sa, unitOfBlock: uobA, units: A },
    { findings: fb.findings, structure: sb, unitOfBlock: uobB, units: B },
    new Map(al.pairs),
  );
  const clauses =
    mode === 'sibling' ? labelClauses(sa, sb, A, B, al.pairs, al.onlyA, al.onlyB) : undefined;

  const sec = { added: 0, removed: 0, renamed: 0, moved: 0, changed: 0, same: 0 };
  for (const s of sections) sec[s.status]++;
  const summary: DiffResult['summary'] = {
    sections: sec,
    findings: {
      fixed: delta.fixed.length,
      stillPresent: delta.stillPresent.length,
      new: delta.new.length,
    },
  };
  if (clauses) {
    const c = { common: 0, differing: 0, only_a: 0, only_b: 0 };
    for (const x of clauses) c[x.label]++;
    summary.clauses = c;
  }
  const noDiff =
    sections.every((s) => s.status === 'same') &&
    definitions.length === 0 &&
    requirements.length === 0 &&
    fees.every((f) => f.status === 'same') &&
    renames.length === 0 &&
    delta.fixed.length === 0 &&
    delta.new.length === 0 &&
    (!clauses || clauses.every((c) => c.label === 'common'));
  const notice: DiffResult['notice'] =
    headedUnitCount(A) < 2 || headedUnitCount(B) < 2
      ? 'not_enough_structure'
      : noDiff
        ? 'no_differences'
        : 'none';

  return {
    mode,
    notice,
    summary,
    sections,
    definitions,
    requirements,
    fees,
    renames,
    possibleLeftovers: possible,
    findingsDelta: delta,
    ...(clauses ? { clauses } : {}),
  };
}

/**
 * Compare two prepared documents (D1, N3). Returns `{result}` or `{error:{side, stage, code}}` for
 * the first failed side (a before b); never throws and never puts document or message text in an
 * error. Output is deterministic and carries no timing.
 */
export function diffDocuments(input: DiffInput): DiffOutcome {
  const bad = sideError('a', input?.a) ?? sideError('b', input?.b);
  if (bad) return { error: bad };
  const a = input.a as SideInput & { ok: true };
  const b = input.b as SideInput & { ok: true };
  const mode: DiffMode = input.mode === 'sibling' ? 'sibling' : 'version';
  try {
    return { result: compute(a.structure, b.structure, a, b, mode) };
  } catch (e) {
    return {
      error: { side: 'a', stage: 'diff', code: e instanceof CoreError ? e.code : 'unknown' },
    };
  }
}

export * from './types';
export { alignUnits, buildUnits, type Unit, type Alignment } from './align';
export { diffText, excerptOf, tokenize, MAX_EDIT_LENGTH } from './diff-text';
export { inferRenames, MIN_COUNT, MIN_COVERAGE } from './rename-inference';
export { QUOTE_SIMILARITY } from './findings-delta';
