import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { detectDocument, resolveRoles } from '../../src/package/index';
import {
  designFiles,
  docOf,
  expectedJson,
  factsOf,
  HARTWELL,
  load,
  PKG,
  type ExpectedFile,
} from '../helpers/package-fixtures';

/** AC-I5 (T1): type correct on every demo file; no high confidence on a wrong type or role. */
const E = expectedJson();

async function packageDocs(rels: string[]) {
  return resolveRoles((await Promise.all(rels.map(load))).map((l) => docOf(factsOf(l))));
}

function checkRows(
  docs: Awaited<ReturnType<typeof packageDocs>>,
  files: Record<string, ExpectedFile>,
) {
  expect(docs.map((d) => d.name).sort()).toEqual(Object.keys(files).sort());
  for (const d of docs) {
    const want = files[d.name]!;
    expect(d.type, d.name).toBe(want.type);
    if (d.confidence === 'high') expect(d.role, d.name).toBe(want.finalRole);
    if (want.mustBeLow) expect(d.confidence, d.name).toBe('low');
    if (want.needsOcr) expect(d.needsOcr, d.name).toBe(true);
  }
}

describe('package-type-detection-golden (AC-I5)', () => {
  it('Hartwell synthetic package', async () => {
    checkRows(await packageDocs([HARTWELL.sub, HARTWELL.lpa, HARTWELL.prior]), E.hartwell.files);
  });

  it.each(Object.keys(E.design))('design package %s', async (id) => {
    checkRows(await packageDocs(designFiles(id)), E.design[id]!.files);
  });

  it('two subscription agreements in one package are both low', async () => {
    const docs = await packageDocs(designFiles('lotus-bay-asia-ii'));
    const subs = docs.filter((d) => d.type === 'sub_agreement');
    expect(subs).toHaveLength(2);
    expect(subs.every((d) => d.confidence === 'low')).toBe(true);
  });

  it.each(Object.keys(E.ngi.files))('NGI real file %s (committed raw HTML)', async (f) => {
    const d = docOf(factsOf(await load(`samples/sub-docs/raw/${f}`)));
    expect(d.type).toBe(E.ngi.files[f]);
  });

  it('NGI #5 and #6 together: both sub agreements, both low (analyst picks)', async () => {
    const docs = await packageDocs(
      Object.keys(E.ngi.files).map((f) => `samples/sub-docs/raw/${f}`),
    );
    expect(docs.map((d) => [d.type, d.confidence])).toEqual([
      ['sub_agreement', 'low'],
      ['sub_agreement', 'low'],
    ]);
  });

  it.each(readdirSync(`${PKG}real-facts`).sort())('committed real facts %s', (f) => {
    const j = JSON.parse(readFileSync(`${PKG}real-facts/${f}`, 'utf8'));
    const want = E.realFacts[j.id]!;
    const d = detectDocument({ name: j.name, titleLines: j.titleLines, headText: j.headText });
    expect(d.type).toBe(want.type);
    expect(d.type).toBe(j.expectedType);
    if (want.mustBeLow) expect(d.confidence).toBe('low');
    if (d.confidence === 'high') expect(d.role).toBe(j.expectedRole);
  });
});
