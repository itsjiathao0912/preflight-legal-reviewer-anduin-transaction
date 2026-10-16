import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeHtml, runDeterministic } from '../../src/engine';
import { edgesOfType, nodesOfType } from '../../src/graph/query';

const fx = (name: string) =>
  analyzeHtml(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));

describe('graph-extraction-fixtures (AC17)', () => {
  it('sections and parts become section/part nodes with contains edges', () => {
    const g = fx('sections-parts.html');
    expect(nodesOfType(g.graph, 'section').map((n) => n.label)).toEqual([
      '1. TYPE OF ACCOUNT (select only one)',
      '2. INVESTOR INFORMATION',
      '3. INVESTMENT DETAILS',
    ]);
    expect(nodesOfType(g.graph, 'part').map((n) => n.label)).toEqual([
      'Part A – Owner’s information',
      'Part B – Joint owner’s information',
      'Part A – Share class',
      'Part B – Investment amount',
    ]);
    const sec3 = nodesOfType(g.graph, 'section')[2]!.id;
    expect(
      edgesOfType(g.graph, 'contains').filter((e) => e.from === sec3 && e.to.startsWith('part:')),
    ).toHaveLength(2);
    const amount = g.structure.blocks.find((b) => b.lines[0]!.text === 'Amount: $')!;
    expect(amount.section_path).toEqual([
      'SUBSCRIPTION AGREEMENT SIGNATURE PAGES',
      '3. INVESTMENT DETAILS',
      'Part B – Investment amount',
    ]);
    expect(amount.kind).toBe('field');
    expect(nodesOfType(g.graph, 'field').map((n) => n.label)).toEqual(
      expect.arrayContaining(['Name', 'Amount']),
    );
  });

  it('references: resolved, unresolved, suspicious and statutory', () => {
    const g = fx('references.html');
    const findings = runDeterministic(g);
    const refs = g.structure.references;
    const sec1 = refs.find((r) => r.ref.text === 'Section 1' && r.form === 'section')!;
    expect(sec1.ref).toMatchObject({ kind: 'internal', status: 'resolved' });
    const sec9 = refs.find((r) => r.ref.text === 'Section 9')!;
    expect(sec9.ref.kind).toBe('external');
    const custodian = refs.find((r) => r.form === 'part_of_section' && r.verb === 'indicated')!;
    expect(custodian.ref.status).toBe('suspicious');
    expect(custodian.ref.expected).toMatchObject({
      sectionNumber: '1',
      label: 'CUSTODIAN INFORMATION',
    });
    const amount = refs.find((r) => r.form === 'part_of_section' && r.verb === 'specified')!;
    expect(amount.ref.status).toBe('resolved');
    expect(amount.qualifier).toBe('Subscription Agreement');
    for (const t of ['Section 406', 'Section 4975', 'Section 3(c)(1)'])
      expect(refs.find((r) => r.ref.text === t)!.ref.kind).toBe('statutory');
    expect(refs.some((r) => r.form === 'rule' && r.ref.kind === 'statutory')).toBe(true);
    expect(edgesOfType(g.graph, 'ref').length).toBeGreaterThan(0);
    expect(findings.map((f) => f.detector_id).sort()).toEqual([
      'ref-label-coherence',
      'ref-this-section',
    ]);
    expect(findings.find((f) => f.detector_id === 'ref-this-section')!.quote).toBe(
      'The representations in this Section 1 are stale.',
    );
  });

  it('conditionals: trigger, action, targets, negative gate and role rows', () => {
    const g = fx('conditionals.html');
    const c = g.structure.conditionals;
    expect(c).toHaveLength(4);
    expect(c[0]).toMatchObject({
      action: 'complete',
      negative: false,
      targets: ['Section 3', 'Section 4'],
    });
    expect(c[1]).toMatchObject({ action: 'complete', negative: true, targets: ['Part C'] });
    expect(c[2]).toMatchObject({
      role: 'Custodial account',
      targets: ['Part A of Section 2', 'Section 4'],
    });
    expect(c[3]).toMatchObject({ action: 'proceed', targets: ['Section 5'] });
    expect(edgesOfType(g.graph, 'conditional')).toHaveLength(6);
  });

  it('option groups with exclusivity cues and defined terms with defines/uses edges', () => {
    const g = fx('options-terms.html');
    const groups = g.structure.optionGroups;
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ exclusive: true, cue: 'check only one' });
    expect(groups[0]!.options.map((o) => o.label)).toEqual(['Individual', 'Joint', 'Trust']);
    expect(groups[1]).toMatchObject({ exclusive: false, cue: 'check all that apply' });
    expect(groups[1]!.options.map((o) => [o.label, o.checked])).toEqual([
      ['Cash', true],
      ['Reinvest', false],
    ]);
    expect(g.structure.definedTerms.map((t) => `${t.term}:${t.form}`)).toEqual([
      'Shares:paren',
      'Fund:paren',
      'Business Day:means',
    ]);
    expect(nodesOfType(g.graph, 'term').map((n) => n.label)).toEqual([
      'Shares',
      'Fund',
      'Business Day',
    ]);
    expect(edgesOfType(g.graph, 'defines')).toHaveLength(3);
    expect(edgesOfType(g.graph, 'uses').filter((e) => e.to === 'term:Business Day')).toHaveLength(
      2,
    );
    expect(nodesOfType(g.graph, 'option')).toHaveLength(5);
  });

  it('a structurer failure returns a partial Doc with stage_failed (never a throw)', async () => {
    const { buildDocGraph } = await import('../../src/engine');
    const bad = [{ text: 'A HEADING THAT NEEDS CUES', cue: null }] as unknown as Parameters<
      typeof buildDocGraph
    >[1];
    const g = buildDocGraph('h', bad, { bytes: 1 });
    expect(g.doc.stage_failed).toBe('structure');
    expect(runDeterministic(g)).toEqual([]);
  });
});
