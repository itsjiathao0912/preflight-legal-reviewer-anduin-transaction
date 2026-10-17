import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { downloadBlob } from '../src/lib/download';

/** AC63: downloadBlob clicks an anchor with the filename and mime, and revokes after a tick. */
describe('download-blob', () => {
  let created: Blob[];
  let revoked: string[];
  let clicks: { download: string; href: string; type: string; inDom: boolean }[];

  beforeEach(() => {
    vi.useFakeTimers();
    created = [];
    revoked = [];
    clicks = [];
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: (b: Blob) => {
        created.push(b);
        return `blob:test/${created.length}`;
      },
      revokeObjectURL: (u: string) => {
        revoked.push(u);
      },
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push({
        download: this.download,
        href: this.getAttribute('href') ?? '',
        type: this.type,
        inDom: document.body.contains(this),
      });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('should revoke the object URL after a tick', () => {
    downloadBlob('a.logic-outline.json', '{"x":1}', 'application/json');
    expect(clicks).toEqual([
      {
        download: 'a.logic-outline.json',
        href: 'blob:test/1',
        type: 'application/json',
        inDom: true,
      },
    ]);
    expect(created[0]!.type).toBe('application/json');
    expect(revoked).toEqual([]);
    vi.advanceTimersByTime(0);
    expect(revoked).toEqual(['blob:test/1']);
    expect(document.querySelectorAll('a').length).toBe(0);
  });

  test('wraps a string in a Blob with the given mime', async () => {
    downloadBlob('n.json', 'hello', 'application/json');
    expect(created[0]).toBeInstanceOf(Blob);
    expect(await created[0]!.text()).toBe('hello');
  });

  test('passes a Blob through unwrapped', () => {
    const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const b = new Blob(['docx'], { type: mime });
    downloadBlob('q.docx', b, mime);
    expect(created[0]).toBe(b);
    expect(clicks[0]).toMatchObject({ download: 'q.docx', type: mime });
    expect(revoked).toEqual([]);
    vi.runAllTimers();
    expect(revoked).toEqual(['blob:test/1']);
  });
});
