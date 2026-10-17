import { describe, expect, it } from 'vitest';
import {
  alignUnits,
  buildUnits,
  DiffResultSchema,
  diffText,
  MAX_EDIT_LENGTH,
} from '../../../src/diff/index';
import {
  allTexts,
  diffOk,
  fixtureJson,
  fixtureSide,
  leakedRuns,
  maskedRender,
  sampleSide,
  sideOf as diffSide,
} from './diff-helpers';

describe('diff-pairs', () => {
  it('should not crash on samples 3 and 4 and list unmatched sections as added or removed', () => {
    const r = diffOk(sampleSide(3), sampleSide(4));
    expect(DiffResultSchema.safeParse(r).success).toBe(true);
    expect(r.summary.sections.added).toBeGreaterThan(0);
    expect(r.summary.sections.removed).toBeGreaterThan(0);
    expect(r.sections.filter((s) => s.status === 'added').every((s) => s.keyB && !s.keyA)).toBe(
      true,
    );
    expect(r.sections.filter((s) => s.status === 'removed').every((s) => s.keyA && !s.keyB)).toBe(
      true,
    );
    expect(r.notice).toBe('none');
  });

  it('should say no differences for an identical pair', () => {
    const exp = fixtureJson<{ a: string; b: string; notice: string }>(
      'expected/identical-pair.json',
    );
    const r = diffOk(fixtureSide(exp.a), fixtureSide(exp.b));
    expect(r.notice).toBe(exp.notice);
    expect(r.sections.every((s) => s.status === 'same')).toBe(true);
    // the same real sample picked twice
    expect(diffOk(sampleSide(5), sampleSide(5)).notice).toBe('no_differences');
  });

  it('should answer not enough structure for an empty or single-section document', () => {
    const exp = fixtureJson<{ notice: string; files: string[] }>(
      'expected/not-enough-structure.json',
    );
    const full = fixtureSide('sibling-A.html');
    for (const f of exp.files) {
      expect(diffOk(fixtureSide(f), full).notice).toBe(exp.notice);
      expect(diffOk(full, fixtureSide(f)).notice).toBe(exp.notice);
      expect(diffOk(fixtureSide(f), fixtureSide(f)).notice).toBe(exp.notice);
    }
  });

  it('should align repeated running headers by ordinal', () => {
    // "1. NOTES" repeats after a numbering reset: each occurrence gets its own ordinal key
    const html = (first: string, second: string) =>
      `<html><body><p><b>1. NOTES</b></p><p>${first}</p><p><b>2. TERMS</b></p><p>x</p>` +
      `<p><b>1. NOTES</b></p><p>${second}</p></body></html>`;
    const a = buildUnits(diffSide(html('first note', 'second note')).structure);
    const b = buildUnits(diffSide(html('first note changed', 'second note')).structure);
    const notes = a.filter((u) => u.headKey === 'notes').map((u) => u.key);
    expect(notes).toEqual(['body:1/s1', 'body:2/s1']);
    expect(new Set(a.map((u) => u.key)).size).toBe(a.length);
    const al = alignUnits(a, b);
    // in sequence: first NOTES <-> first NOTES, second <-> second
    for (const [ia, ib] of al.pairs) expect(a[ia]!.key).toBe(b[ib]!.key);
    expect(al.pairs).toHaveLength(a.length);
    expect(al.onlyA).toEqual([]);
    expect(al.onlyB).toEqual([]);
    const r = diffOk(
      diffSide(html('first note', 'second note')),
      diffSide(html('first note changed', 'second note')),
    );
    const changed = r.sections.filter((s) => s.status === 'changed').map((s) => s.keyA);
    expect(changed).toEqual(['body:1/s1']);
  });

  it('should align a document with itself using only exact anchors (complexity bound)', () => {
    for (const n of [2, 5]) {
      const u = buildUnits(sampleSide(n).structure);
      const al = alignUnits(u, u);
      expect(al.stats.exact).toBe(u.length);
      expect(al.stats.lcsCells).toBe(0);
      expect(al.stats.simPairs).toBe(0);
    }
  });

  it('should fall back to a coarse diff when jsdiff returns undefined', () => {
    const a = Array.from({ length: 60 }, (_, i) => `alpha${i}`).join(' ');
    const b = Array.from({ length: 60 }, (_, i) => `beta${i}`).join(' ');
    const d = diffText(a, b, 5);
    expect(d.truncated).toBe(true);
    expect(d.parts).toBeUndefined();
    expect(d.segments.map((s) => s.op)).toEqual(['del', 'add']);
    expect(d.segments[0]!.text).toBe(a);
    expect(d.segments[1]!.text).toBe(b);
    expect(diffText(a, b, 5)).toEqual(d);
    expect(diffText(a, b, MAX_EDIT_LENGTH).truncated).toBe(false);
  });

  it('no-raw-sensitive-digits: should not leak sensitive digits in masked diff text', () => {
    const exp = fixtureJson<{ sensitive: { clause: string; a: string; b: string } }>(
      'expected/sibling-A-vs-B.json',
    );
    for (const mode of ['version', 'sibling'] as const) {
      const r = diffOk(fixtureSide('sibling-A.html'), fixtureSide('sibling-B.html'), mode);
      const texts = allTexts(r);
      // non-vacuous: the raw excerpts DO carry both seeded numbers, each covered by a span
      for (const secret of [exp.sensitive.a, exp.sensitive.b]) {
        const holders = texts.filter((t) => t.text.includes(secret));
        expect(holders.length).toBeGreaterThan(0);
        for (const t of holders) {
          const at = t.text.indexOf(secret);
          expect(t.sensitiveSpans.some((s) => s.start <= at && s.end >= at + secret.length)).toBe(
            true,
          );
        }
      }
      // the changed token itself is a whole del/add segment pair (E17: never split across segments)
      const sec = r.sections.find((s) => s.segments?.some((g) => g.text.includes(exp.sensitive.a)));
      expect(sec).toBeDefined();
      const del = sec!.segments!.find((g) => g.op === 'del' && g.text.includes(exp.sensitive.a))!;
      const add = sec!.segments!.find((g) => g.op === 'add' && g.text.includes(exp.sensitive.b))!;
      expect(del && add).toBeTruthy();
      // masked render leaks no 4+ digit run of either number except the mask's last-4
      for (const t of texts) {
        const out = maskedRender(t);
        expect(leakedRuns(out, exp.sensitive.a)).toEqual([]);
        expect(leakedRuns(out, exp.sensitive.b)).toEqual([]);
      }
    }
  });

  it('should keep a number split by jsdiff segment boundaries whole (E17)', () => {
    const d = diffText('Wire to ABA 021 000 021 today', 'Wire to ABA 021 000 089 today');
    const withDigits = d.segments.filter((s) => /\d/.test(s.text));
    for (const s of withDigits) {
      expect(s.sensitiveSpans.length).toBeGreaterThan(0);
      expect(leakedRuns(maskedRender(s), '021000021')).toEqual([]);
      expect(leakedRuns(maskedRender(s), '021000089')).toEqual([]);
    }
  });
});
