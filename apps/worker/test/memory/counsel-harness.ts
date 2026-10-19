// Counsel share link HTTP helpers (not a gate file): share as the analyst, join as counsel (a
// distinct IP, no analyst cookie), and call with the counsel cookie only.
/** Default bundled doc ref used by share tests. */
export const DOC_REF = 'package:hartwell';
/** Analyst sheet path (the analyst names the open doc ref; counsel's comes from its cookie). */
export const ANALYST_SHEET = `/api/counsel/sheet?doc_ref=${DOC_REF}`;
import { COUNSEL_COOKIE } from '../../src/memory/share';
import { call, type CallOpts, type MemHarness, type Session } from './memory-harness';

export async function shareToken(
  h: MemHarness,
  s: Session,
  docRef: string = DOC_REF,
): Promise<{ token: string; expiresAt: number }> {
  const r = await call(h, 'POST', '/api/counsel/share', { doc_ref: docRef }, { cookie: s.cookie });
  if (r.status !== 200) throw new Error(`share failed: ${r.status} ${JSON.stringify(r.body)}`);
  return { token: r.body.token, expiresAt: r.body.expires_at };
}

export function counselCookieOf(res: Response): string | undefined {
  const sc = res.headers.get('set-cookie');
  if (!sc || !sc.startsWith(`${COUNSEL_COOKIE}=`)) return undefined;
  return sc.split(';')[0];
}

export async function joinAsCounsel(
  h: MemHarness,
  token: string,
  name = 'Rita Okafor',
  o: CallOpts = {},
): Promise<{
  cookie: string;
  body: { workspace_id: string; counsel_name: string; expires_at: number; doc_ref: string };
}> {
  const r = await call(h, 'POST', '/api/counsel/join', { token, name }, { ip: '192.0.2.44', ...o });
  if (r.status !== 200) throw new Error(`join failed: ${r.status} ${JSON.stringify(r.body)}`);
  const cookie = counselCookieOf(r.res);
  if (!cookie) throw new Error('no counsel cookie');
  return { cookie, body: r.body };
}

/** Share + join in one step. */
export async function counselFor(h: MemHarness, s: Session, name?: string): Promise<string> {
  const { token } = await shareToken(h, s);
  return (await joinAsCounsel(h, token, name)).cookie;
}
