import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeHtml, runDeterministic } from '../../src/engine';
import { buildStructureView, LENS_IDS, type StructureView } from '../../src/structure-view/build';
import { analyzed } from '../helpers/samples';

/** AC17: pure structure view model: lens contents, issue counts, badge total, determinism. */
const seeded = (rel: string) =>
  readFileSync(new URL(`../../../../fixtures/html-seeded/${rel}`, import.meta.url), 'utf8');

function view(html: string): StructureView {
  const g = analyzeHtml(html);
  return buildStructureView(g, runDeterministic(g));
}

describe('structure-view-build (AC17)', () => {
  it('should build the structure view model with lens contents, counts and badge total', () => {
    const { g, findings } = analyzed(3);
    const v = buildStructureView(g, findings);
    expect(Object.keys(v.counts).sort()).toEqual([...LENS_IDS].sort());
    // badge = sum of the per-lens issue counts (sections are context, never counted)
    expect(v.counts.sections).toBe(0);
    expect(v.badge).toBe(
      v.counts.crossrefs +
        v.counts.conditions +
        v.counts.options +
        v.counts.terms +
        v.counts.investors,
    );
    for (const lens of ['crossrefs', 'conditions', 'options', 'terms'] as const)
      expect(v.counts[lens]).toBe(v[lens].filter((r) => r.issue).length);
    expect(v.totals.crossrefs).toBe(v.crossrefs.length);
    // the two golden swapped Part B references are the suspicious rows, linked to their findings
    const sus = v.crossrefs.filter((r) => r.status === 'suspicious');
    expect(sus).toHaveLength(2);
    for (const r of sus) {
      expect(r.issue).toBe(true);
      expect(
        findings.some((f) => f.id === r.findingId && f.detector_id === 'ref-label-coherence'),
      ).toBe(true);
      expect(r.expected).toMatch(/^Section \d/);
    }
    // sections: Section 2 of the signature pages has Parts A to C (restart badge) and part rows
    const s2 = v.sections.filter((r) => r.number === '2' && r.depth === 0);
    expect(s2.some((r) => r.restart && /Parts A to C/.test(r.numbering))).toBe(true);
    expect(v.sections.some((r) => r.depth === 1)).toBe(true);
    // the role-routing table rows are conditions; the investor types lens lists 9 types
    expect(v.conditions.filter((c) => c.kind === 'role')).toHaveLength(3);
    expect(v.investors.types.length).toBeGreaterThanOrEqual(8);
    expect(v.investors.preselected).toBe('partnership');
  });

  it('statutory and external citations are listed separately, never as internal references', () => {
    const v = buildStructureView(analyzed(1).g, analyzed(1).findings);
    expect(v.external.length).toBeGreaterThan(0);
    const internal = new Set(v.crossrefs.map((r) => r.id.slice(2)));
    for (const x of v.external) expect(internal.has(x.id.slice(2))).toBe(false);
    expect(v.crossrefs.some((r) => /1940|Rule \d|U\.S\.C/.test(r.text))).toBe(false);
  });

  it('defined-term rows carry the finding status; undefined terms appear as "none"', () => {
    const v = view(seeded('defined-term-issues/duplicate.html'));
    const fund = v.terms.find((t) => t.term === 'Fund')!;
    expect(fund.status).toBe('twice');
    expect(fund.issue).toBe(true);
    expect(v.counts.terms).toBe(1);
    const units = buildStructureView(analyzed(11).g, analyzed(11).findings).terms.find(
      (t) => t.term === 'Units',
    )!;
    expect(units.status).toBe('none');
    expect(units.definedAt).toBe('Not defined');
  });

  it('conditions, option groups and investor gaps feed the badge', () => {
    const broken = view(seeded('broken-conditional/missing-section.html'));
    expect(broken.conditions.filter((c) => !c.targetFound)).toHaveLength(1);
    expect(broken.counts.conditions).toBe(1);
    const overlap = view(seeded('option-gap-overlap/overlap.html'));
    expect(overlap.options[0]!.findingId).not.toBeNull();
    expect(overlap.options[0]!.issue).toBe(true);
    const stated = view(seeded('option-gap-overlap/clean.html')).options.find((o) => o.cueStated)!;
    // P2-4 (Phase 05): "(check one)" is now a stated cue, so the first stated group is "Annual income"
    expect(stated.cueText).toBe('(check one)');
    expect(
      view(seeded('option-gap-overlap/clean.html'))
        .options.filter((o) => o.cueStated)
        .map((o) => o.cueText),
    ).toEqual(['(check one)', 'check only one']);
    expect(stated.howMany).toBe('one');
    const peer = view(seeded('investor-path-missing-item/peer-item.html'));
    const pship = peer.investors.types.find((t) => t.type === 'partnership')!;
    expect(pship.gaps).toHaveLength(1);
    expect(pship.gaps[0]!.kind).toBe('peer-item');
    expect(pship.gaps[0]!.peers).toEqual(['Trust', 'Corporation', 'Other entity']);
    expect(peer.counts.investors).toBe(1);
    expect(peer.badge).toBeGreaterThanOrEqual(1);
  });

  it('empty state: no investor types gives an empty lens, not an error', () => {
    const v = view(seeded('flag-placeholder/placeholders.html'));
    expect(v.investors.types).toEqual([]);
    expect(v.investors.preselected).toBeNull();
  });

  it('is deterministic: 5 runs are byte-equal', () => {
    const bytes = readFileSync(
      new URL('../../../../fixtures/memory/fund-II.html', import.meta.url),
    );
    const runs = Array.from({ length: 5 }, () => {
      const g = analyzeHtml(new Uint8Array(bytes));
      return JSON.stringify(buildStructureView(g, runDeterministic(g)));
    });
    for (const r of runs) expect(r).toBe(runs[0]);
    const s5 = Array.from({ length: 3 }, () =>
      JSON.stringify(
        buildStructureView(
          analyzeHtml(
            new Uint8Array(
              readFileSync(
                new URL(
                  '../../../../samples/sub-docs/raw/05-partners-group-ngi-2024.htm',
                  import.meta.url,
                ),
              ),
            ),
          ),
          [],
        ),
      ),
    );
    expect(new Set(s5).size).toBe(1);
  });

  it('is structured-clone safe and masks account-like numbers in every string', () => {
    const v = view(seeded('flag-sensitive/aba-dda.html'));
    expect(structuredClone(v)).toEqual(v);
    expect(JSON.stringify(v)).not.toMatch(/990000017|000111222333/);
  });
});
