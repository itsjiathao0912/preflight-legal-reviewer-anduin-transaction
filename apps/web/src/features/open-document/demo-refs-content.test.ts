import { afterEach, describe, expect, it, vi } from 'vitest';
import { docRefOf, forgetDemoPackagesForTest, matchDemoPackage, resolveDocRef } from './demo-refs';
import type { DocMeta } from '../../state/review';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const C = 'c'.repeat(64);
const demos = [{ id: 'northgate-iii', firmId: 'hartwell-crane', count: 2, hashes: [A, B] }];

describe('demo ref from package content (restored / new tab)', () => {
  afterEach(() => {
    forgetDemoPackagesForTest();
    vi.unstubAllGlobals();
  });

  it('a restored package has no tab-memory ref (the live bug)', () => {
    const doc = { packageId: 'row-1', source: 'upload', firmId: 'hartwell-crane' } as DocMeta;
    expect(docRefOf(doc)).toBeNull();
  });

  it('matches by firm, member count and content hashes', () => {
    const pkg = { id: 'row-1', firmId: 'hartwell-crane', docIds: [B, A] };
    expect(matchDemoPackage(pkg, demos)).toBe('northgate-iii');
    expect(matchDemoPackage({ ...pkg, firmId: 'other' }, demos)).toBeNull();
    expect(matchDemoPackage({ ...pkg, docIds: [A, C] }, demos)).toBeNull();
    expect(matchDemoPackage({ ...pkg, docIds: [A, B, C] }, demos)).toBeNull();
  });

  it('resolveDocRef fetches demo files, hashes them and remembers the ref', async () => {
    const bytes = new TextEncoder().encode('northgate');
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/samples/packages.json')
          return new Response(
            JSON.stringify({
              packages: [
                {
                  id: 'northgate-iii',
                  title: 'N',
                  firmId: 'hartwell-crane',
                  fund: 'F',
                  version: 'v1',
                  members: [
                    { kind: 'file', name: 'x.docx', url: '/samples/packages/northgate-iii/x.docx' },
                  ],
                },
              ],
            }),
          );
        if (url === '/samples/manifest.json') return new Response('[]');
        return new Response(bytes);
      }),
    );
    const doc = { packageId: 'row-9', source: 'upload', firmId: 'hartwell-crane' } as DocMeta;
    const ref = await resolveDocRef(doc, { id: 'row-9', firmId: 'hartwell-crane', docIds: [hash] });
    expect(ref).toBe('package:northgate-iii');
    expect(docRefOf(doc)).toBe('package:northgate-iii');
  });
});
