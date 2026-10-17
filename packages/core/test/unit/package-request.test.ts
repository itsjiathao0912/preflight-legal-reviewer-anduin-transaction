import { describe, expect, it } from 'vitest';
import { buildDocumentRequests, type ExternalReference } from '../../src/package/index';
import {
  designFiles,
  expectedJson,
  HARTWELL,
  rolesOf,
  runPackage,
} from '../helpers/package-fixtures';

const P = 'p'.replace('p', 'a').repeat(64);
const ref = (
  key: string,
  label: string,
  block: number,
  resolution: ExternalReference['resolution'] = 'not_in_package',
): ExternalReference => ({
  id: '0'.repeat(16),
  quote: `quote ${block}`,
  location: { blockIndex: block, start: 0, end: 1, sectionPath: [] },
  targetLabel: label,
  targetKey: key,
  targetFamily: key.startsWith('annex') ? 'annex' : 'lpa',
  resolution,
  confirmedByAnalyst: false,
});

describe('package-request (AC-I20 core, T3)', () => {
  it('dedupes by target key, keeps the first mention label and quote, counts mentions', () => {
    const r = buildDocumentRequests(
      [
        ref('lpa', 'LP Agreement', 9),
        ref('lpa', 'Partnership Agreement', 2),
        ref('annex:annex f', 'Annex F', 5),
      ],
      P,
    );
    expect(r.map((x) => [x.label, x.quote, x.count])).toEqual([
      ['Partnership Agreement', 'quote 2', 2],
      ['Annex F', 'quote 5', 1],
    ]);
    expect(r.every((x) => x.firstDocId === P && /^[0-9a-f]{16}$/.test(x.id))).toBe(true);
  });

  it('unclear and resolved references are never requests', () => {
    expect(
      buildDocumentRequests([ref('lpa', 'LPA', 1, 'unclear'), ref('ppm', 'PPM', 2, 'resolved')], P),
    ).toEqual([]);
  });

  it('Hartwell package: one request each for Annex F, Form W-8BEN-E and the Side Letter', async () => {
    const e = expectedJson().hartwell;
    const r = await runPackage([HARTWELL.sub, HARTWELL.lpa, HARTWELL.prior]);
    expect(r.analysis.requests.map((x) => x.label)).toEqual(e.requests);
    const noLpa = await runPackage([HARTWELL.sub, HARTWELL.prior]);
    expect(noLpa.analysis.requests.map((x) => x.label)).toEqual(e.requestsWithoutLpa);
  });

  it.each(['northgate-iii', 'lotus-bay-asia-ii', 'redwood-ridge-i'])(
    'design package %s: request list equals the answer-key derived list',
    async (id) => {
      const e = expectedJson().design[id];
      const r = await runPackage(designFiles(id), { roles: rolesOf(e!.files) });
      expect(r.analysis.requests.map((x) => x.label)).toEqual(e!.requests);
      for (const q of r.analysis.requests) expect(q.quote.length).toBeGreaterThan(0);
    },
  );
});
