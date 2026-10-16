import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('@aduin/worker health (workerd)', () => {
  it('GET /api/health returns {ok:true}', async () => {
    const res = await SELF.fetch('https://example.com/api/health');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ ok: true });
  });

  it('unknown /api/* path is a JSON 404, not the SPA', async () => {
    const res = await SELF.fetch('https://example.com/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: 'not_found' });
  });
});
