import { describe, expect, it, vi } from 'vitest';
import { startFresh } from './start-fresh';

function fakeStorage(): Storage & { cleared: boolean } {
  const s = { cleared: false, clear: vi.fn(() => void (s.cleared = true)) };
  return s as unknown as Storage & { cleared: boolean };
}

describe('startFresh', () => {
  it('calls the reset route, deletes the DB, clears storage, then reloads', async () => {
    const order: string[] = [];
    const fetchFn = vi.fn(async () => {
      order.push('fetch');
      return new Response('{"ok":true}');
    });
    const ls = fakeStorage();
    const ss = fakeStorage();
    await startFresh({
      fetch: fetchFn as unknown as typeof fetch,
      deleteDb: async () => void order.push('db'),
      storages: () => [ls, ss],
      reload: () => void order.push('reload'),
    });
    expect(fetchFn).toHaveBeenCalledWith(
      '/api/session/reset',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-aduin-client': '1' }),
      }),
    );
    expect(ls.cleared && ss.cleared).toBe(true);
    expect(order).toEqual(['fetch', 'db', 'reload']);
  });

  it('still clears local data and reloads when the reset call fails', async () => {
    const reload = vi.fn();
    const deleteDb = vi.fn(async () => undefined);
    const ls = fakeStorage();
    await startFresh({
      fetch: (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch,
      deleteDb,
      storages: () => [ls],
      reload,
    });
    expect(deleteDb).toHaveBeenCalled();
    expect(ls.cleared).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
  });
});
