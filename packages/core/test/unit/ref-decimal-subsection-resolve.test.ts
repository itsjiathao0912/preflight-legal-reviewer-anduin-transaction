import { describe, expect, it } from 'vitest';
import { graphOf, load } from '../helpers/package-fixtures';

/**
 * Regression: decimal references ("Section 3.2", "Section 14.7.") in DOCX sub agreements whose
 * numbered sub-clauses carry "N.M" labels resolve to their parent section instead of showing
 * "Not found". Decimal refs to sub-clauses absent from the document stay unresolved.
 */
const internal = async (rel: string) =>
  graphOf(await load(rel)).structure.references.filter((r) => r.ref.kind === 'internal');

describe('decimal section refs resolve to their parent section when the sub-clause exists', () => {
  it('Northgate III sub agreement: every internal reference resolves (was 9 unresolved)', async () => {
    const refs = await internal(
      'fixtures/package/design/northgate-iii/01-NG3-Subscription-Agreement.docx',
    );
    expect(refs.filter((r) => r.ref.status === 'unresolved')).toEqual([]);
    const decimal = refs.filter((r) => r.rule === 'decimal-section');
    expect(decimal.length).toBe(9);
    for (const r of decimal) {
      expect(r.ref.status).toBe('resolved');
      expect(r.ref.target?.sectionNumber).toBe(r.sectionNumber);
    }
    expect(new Set(decimal.map((r) => r.sectionNumber))).toEqual(
      new Set(['1', '3', '4', '7', '13', '14']),
    );
  });

  it('an LPA extract citing sections it does not reproduce keeps them unresolved', async () => {
    const refs = await internal(
      'fixtures/package/design/northgate-iii/02-NG3-LPA-Definitions-and-Key-Terms.docx',
    );
    expect(refs.filter((r) => r.ref.status === 'unresolved').length).toBe(56);
  });
});
