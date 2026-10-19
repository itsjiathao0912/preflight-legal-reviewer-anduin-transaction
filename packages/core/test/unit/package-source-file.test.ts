import { describe, expect, it } from 'vitest';
import { htmlToLines } from '../../src/adapters/html';
import {
  CrossDocTermSchema,
  ExternalReferenceSchema,
  PackageFactsSchema,
  buildCrossDocTerms,
  buildPackageFacts,
  citedPartLabel,
  extractParts,
  packageViewBlocks,
  resolveReferences,
  type PackageDocument,
  type PackageFacts,
  type PrimaryFacts,
  type RawReference,
} from '../../src/package/index';
import { structure } from '../../src/structure/structurer';
import { factsOf, load } from '../helpers/package-fixtures';

const LPA_H = 'a'.repeat(64);
const SUB_H = 'b'.repeat(64);

const LPA_HTML = `<html><body>
<p>Example Fund, L.P. Limited Partnership Agreement</p>
<p>Section 1.1 Defined Terms. As used in this Agreement, the following terms apply.</p>
<p>“Affiliate” means any person under common control.</p>
<p>“Capital Commitment” means the amount a partner agreed to contribute.</p>
<p>Section 3.1 Capital Calls</p>
<p>The General Partner may call contributions on ten Business Days notice.</p>
<p>Section 3.2 Permitted Uses</p>
<p>Contributions may be called to fund investments.</p>
<p>4.1 Management Fee. The fee is paid quarterly.</p>
<p>4.1 Management Fee. A second copy of the same label.</p>
</body></html>`;

function lpaFacts(): PackageFacts {
  const r = htmlToLines(LPA_HTML);
  return buildPackageFacts({
    contentHash: LPA_H,
    name: 'lpa.html',
    format: 'html',
    bytes: r.bytes,
    lines: r.lines,
  });
}

const doc = (id: string, type: PackageDocument['type'], role: PackageDocument['role']) =>
  ({
    id,
    name: `${type}.html`,
    type,
    role,
    confidence: 'high',
    reason: '',
    confirmed: true,
    suggestionSource: 'rule',
    needsOcr: false,
    format: 'html',
    titleLines: [],
  }) satisfies PackageDocument;

const ref = (quote: string): RawReference => ({
  quote,
  location: { blockIndex: 0, start: 0, end: 5, sectionPath: [] },
  targetLabel: 'Partnership Agreement',
  targetKey: 'lpa',
  targetFamily: 'lpa',
});

describe('package-source-file: numbered parts', () => {
  it('should index unique N.M and Section N labels with titles, dropping duplicates', () => {
    const f = lpaFacts();
    expect(PackageFactsSchema.safeParse(f).success).toBe(true);
    const labels = (f.parts ?? []).map((p) => `${p.label}|${p.title}`);
    expect(labels).toEqual(['1.1|Defined Terms', '3.1|Capital Calls', '3.2|Permitted Uses']);
  });

  it('should never take a lower-case continuation as a part ("1.5 million")', () => {
    const r = htmlToLines('<html><body><p>1.5 million units were sold.</p></body></html>');
    expect(extractParts(structure(LPA_H, r.lines).blocks)).toEqual([]);
  });

  it('should give each definition its section label and paragraph', () => {
    const f = lpaFacts();
    const cc = f.definitions.find((d) => d.term === 'Capital Commitment');
    expect(cc?.sectionLabel).toBe('1.1');
    expect(cc?.paragraph).toBe(3);
  });

  it('should index viewer blocks exactly like the facts', () => {
    const r = htmlToLines(LPA_HTML);
    const blocks = packageViewBlocks(LPA_H, r.lines);
    const f = lpaFacts();
    const cc = f.definitions.find((d) => d.term === 'Capital Commitment')!;
    expect(blocks[cc.location.blockIndex]!.text).toContain('“Capital Commitment” means');
  });
});

describe('package-source-file: cross-doc term location', () => {
  it('should carry an optional definitionLocation on defined terms', () => {
    const f = lpaFacts();
    const primary: PrimaryFacts = {
      docId: SUB_H,
      references: [],
      dropped: 0,
      usedTerms: [
        {
          term: 'Capital Commitment',
          mentions: 2,
          firstLocation: { blockIndex: 0, start: 0, end: 1, sectionPath: [] },
        },
      ],
      carveOutTarget: 'Partnership Agreement',
      localTerms: [],
      scopeLabels: [],
      suppressed: [],
    };
    const [t] = buildCrossDocTerms(primary, f.definitions, true);
    expect(CrossDocTermSchema.safeParse(t).success).toBe(true);
    expect(t?.definitionLocation).toMatchObject({ sectionLabel: '1.1', paragraph: 3 });
  });

  it('should stay valid without the new optional fields (back-compat)', () => {
    expect(
      CrossDocTermSchema.safeParse({ term: 'X', status: 'unverified', mentions: 1 }).success,
    ).toBe(true);
  });
});

describe('package-source-file: external reference part resolution', () => {
  const run = (quote: string) =>
    resolveReferences(
      [ref(quote)],
      [doc(SUB_H, 'sub_agreement', 'to_digitize'), doc(LPA_H, 'lpa', 'reference')],
      [lpaFacts()],
      {},
      SUB_H,
    )[0]!;

  it('should resolve "Section 3.2 of the Partnership Agreement" when 3.2 exists', () => {
    const r = run('as set out in Section 3.2 of the Partnership Agreement.');
    expect(r.resolution).toBe('resolved');
    expect(r.resolvedPart).toMatchObject({ label: '3.2', title: 'Permitted Uses' });
    expect(ExternalReferenceSchema.safeParse(r).success).toBe(true);
  });

  it('should keep the whole-file resolution when the cited part is not in the file', () => {
    const r = run('as set out in Section 9.4 of the Partnership Agreement.');
    expect(r.resolution).toBe('resolved');
    expect(r.resolvedPart).toBeUndefined();
  });

  it('should never guess a duplicated label', () => {
    expect(run('see Section 4.1 of the Partnership Agreement.').resolvedPart).toBeUndefined();
  });

  it('should not cite a part when no section precedes the document name', () => {
    expect(citedPartLabel(ref('under the Partnership Agreement.'))).toBeNull();
    expect(citedPartLabel(ref('Sections 3.1 and 3.2 of the Partnership Agreement'))).toBeNull();
  });

  it('should not cite a part when the label appears twice in the quote', () => {
    expect(
      citedPartLabel(
        ref('Section 3.2 of the Partnership Agreement and the Partnership Agreement itself'),
      ),
    ).toBeNull();
  });
});

describe('package-source-file: Northgate LPA', () => {
  it('should place Capital Commitment in Section 1.1 of the Northgate LPA', async () => {
    const f = factsOf(
      await load('fixtures/package/design/northgate-iii/02-NG3-LPA-Definitions-and-Key-Terms.docx'),
    );
    const cc = f.definitions.find((d) => d.term === 'Capital Commitment');
    expect(cc?.sectionLabel).toBe('1.1');
    expect(cc?.paragraph).toBeGreaterThan(1);
    expect((f.parts ?? []).some((p) => p.label === '3.2' && p.title === 'Permitted Uses')).toBe(
      true,
    );
  });
});
