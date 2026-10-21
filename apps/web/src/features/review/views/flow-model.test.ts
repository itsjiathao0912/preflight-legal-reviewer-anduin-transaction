import { describe, expect, it } from 'vitest';
import type { StructureView } from '@aduin/core';
import { flowItems, flowPath, runLabel, typeStuck } from './flow-model';

const type = (t: string, label: string) => ({
  type: t,
  label,
  sections: [{ number: '1', title: 'Subscription' }],
  skipped: [],
  questions: [],
  reachesCompletion: true,
  uncertain: false,
  gaps: [],
});

const view = {
  sections: [],
  crossrefs: [],
  options: [],
  conditions: [
    {
      id: 'c1',
      kind: 'skip',
      text: 't',
      where: 'Section 9',
      condition: 'If the Investor is a Benefit Plan Investor,',
      target: 'Annex F',
      targetFound: false,
      findingId: 'e1',
      issue: true,
      blockId: 'b9',
    },
  ],
  investors: {
    types: [
      type('person', 'Natural person'),
      type('plan', 'Employee benefit plan or other Benefit Plan Investor'),
    ],
  },
} as unknown as StructureView;

describe('typeStuck', () => {
  it('marks the benefit plan type stuck through its broken branch', () => {
    expect(typeStuck(view, view.investors.types[1]!)).toBe(true);
    expect(flowPath(view, 'plan').reaches).toBe(false);
  });
  it('leaves the natural person type reaching the signature', () => {
    expect(typeStuck(view, view.investors.types[0]!)).toBe(false);
    expect(flowPath(view, 'person').reaches).toBe(true);
  });
});

const secs = ['1', '2', '3', '4', '5', '9'].map((n) => ({ number: n, title: `S${n}` }));
const typed = (t: string, label: string, questions: { section: string; text: string }[]) => ({
  ...type(t, label),
  sections: secs,
  questions,
});
const view2 = {
  ...view,
  investors: {
    types: [
      typed('person', 'Natural person', [{ section: '1', text: 'Provide your SSN' }]),
      typed('plan', 'Employee benefit plan or other Benefit Plan Investor', [
        { section: '1', text: 'Provide your EIN' },
        { section: '9', text: 'Complete Annex F' },
      ]),
    ],
  },
} as unknown as StructureView;

describe('type-specific flowPath', () => {
  it('gives natural person and benefit plan different step content', () => {
    const p = flowPath(view2, 'person').steps[0]!;
    const b = flowPath(view2, 'plan').steps[0]!;
    expect(p.typeQuestions).toEqual(['Provide your SSN']);
    expect(b.typeQuestions).toEqual(['Provide your EIN']);
    expect(p.onlyType && b.onlyType).toBe(true);
  });
  it('shows the Annex F break only for the benefit plan type', () => {
    const b = flowPath(view2, 'plan').steps.find((s) => s.number === '9')!;
    expect(b.breaks.map((x) => x.id)).toEqual(['c1']);
    const p = flowPath(view2, 'person');
    const s9 = p.steps.find((s) => s.number === '9')!;
    expect(s9.breaks).toEqual([]);
    expect(s9.appliesTo).toEqual(['Employee benefit plan or other Benefit Plan Investor']);
    expect(p.other).toEqual([]);
  });
  it('collapses plain runs into one row', () => {
    const items = flowItems(flowPath(view2, 'person').steps);
    expect(items.map((i) => i.kind)).toEqual(['step', 'run', 'step']);
    const run = items[1] as { kind: 'run'; steps: { number: string }[] };
    expect(runLabel(run.steps as never)).toBe('Sections 2–5 · same for every type');
  });
});
