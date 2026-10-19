import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { docxToLines } from '../../src/adapters/docx';
import { analyzeHtml, buildDocGraph, runDeterministic } from '../../src/engine';
import { buildStructureView } from '../../src/index';
import { investorModelOf } from '../../src/investor/paths';
import { extractConditionals, withoutPlease } from '../../src/structure/conditionals';
import { splitInstructionRow } from '../../src/structure/option-groups';
import { readSample } from '../helpers/samples';

const NG3 = join(
  __dirname,
  '../../../../fixtures/package/design/northgate-iii/01-NG3-Subscription-Agreement.docx',
);

async function ng3() {
  const r = await docxToLines(new Uint8Array(readFileSync(NG3)));
  return buildDocGraph(r.docHash, r.lines, { bytes: r.bytes, adapter_ms: r.adapter_ms }, 'docx');
}

describe('option tables with an Instructions column (NG3)', () => {
  it('keeps the instruction out of option labels and investor-type names', async () => {
    const g = await ng3();
    const group = g.structure.optionGroups.find((og) =>
      og.options.some((o) => o.label.startsWith('Natural person')),
    )!;
    expect(group).toBeDefined();
    for (const o of group.options) {
      expect(o.label).not.toMatch(/please complete/i);
      expect(o.instruction).toMatch(/^Please complete Part A/);
    }
    expect(group.options[0]!.label).toBe('Natural person (individual)');
    expect(group.question).toBe('Investor type');
    const types = investorModelOf(g).types;
    expect(types.length).toBeGreaterThanOrEqual(5);
    for (const t of types) expect(t.label).not.toMatch(/please complete/i);
  });

  it('does not use the header row as question or location, nor open a scope', async () => {
    const g = await ng3();
    expect(g.structure.scopes.map((s) => s.title)).not.toContain(
      'Select one Investor type Instructions',
    );
    const view = buildStructureView(g, runDeterministic(g));
    for (const row of view.options) {
      expect(row.question).not.toMatch(/Instructions|^Select one|^Mark /);
      expect(row.where).not.toMatch(/Instructions/);
    }
    const inv = view.options.find((r) => r.options[0] === 'Natural person (individual)')!;
    expect(inv.question).toBe('Investor type');
    expect(inv.where).toBe('Section 6, Part A');
  });

  it('drops "please" between the condition and the verb', async () => {
    const g = await ng3();
    const c = g.structure.conditionals.find((x) => x.targets.includes('Annex F'))!;
    expect(c.trigger).toBe('If the Investor is a Benefit Plan Investor');
    for (const x of g.structure.conditionals) expect(x.trigger).not.toMatch(/\bplease$/i);
    expect(withoutPlease('If the Investor is a trust, Please ')).toBe('If the Investor is a trust');
    expect(withoutPlease('If pleased')).toBe('If pleased');
  });
});

describe('instruction split stays conservative', () => {
  it('splits only when every later cell is instruction-like', () => {
    expect(splitInstructionRow(['☐', 'Corporation', 'Please complete Part A'], undefined)).toEqual({
      label: 'Corporation',
      instruction: 'Please complete Part A',
      labelCell: 1,
    });
    expect(splitInstructionRow(['☐', 'Canada', 'Province: ____'], undefined)).toBeNull();
    expect(
      splitInstructionRow(['☐', 'Trust', 'Part B'], ['Select one', 'Type', 'Instructions']),
    ).toEqual({ label: 'Trust', instruction: 'Part B', labelCell: 1 });
  });

  it('a synthetic HTML option table splits the same way', () => {
    const html =
      '<html><body><p><b>1. Investor Type</b></p><table>' +
      '<tr><th>Select one</th><th>Investor type</th><th>Instructions</th></tr>' +
      '<tr><td>☐</td><td>Individual</td><td>Please complete Part A of Section 2</td></tr>' +
      '<tr><td>☐</td><td>Corporation</td><td>Please complete Part B of Section 2</td></tr>' +
      '</table></body></html>';
    const g = analyzeHtml(html);
    const og = g.structure.optionGroups[0]!;
    expect(og.options.map((o) => o.label)).toEqual(['Individual', 'Corporation']);
    expect(og.question).toBe('Investor type');
    expect(extractConditionals(g.structure.blocks).every((c) => !/please$/i.test(c.trigger))).toBe(
      true,
    );
  });
});

describe('Partners Group role tables are unchanged (#3, #5)', () => {
  it.each([3, 5])('sample %i: option groups and role conditionals still parse', (n) => {
    const g = analyzeHtml(readSample(n));
    expect(g.structure.optionGroups.length).toBeGreaterThan(0);
    for (const og of g.structure.optionGroups)
      for (const o of og.options) expect(o.instruction).toBeUndefined();
    const roles = g.structure.conditionals.filter((c) => c.role);
    expect(roles.map((c) => c.role)).toEqual(
      expect.arrayContaining(['Single owner', 'Qualified plan account']),
    );
    for (const c of roles) expect(c.targets.length).toBeGreaterThan(0);
  });
});
