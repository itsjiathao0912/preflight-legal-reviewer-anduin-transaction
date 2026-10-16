// Turnstile siteverify stub (injected fetch). Mirrors Cloudflare's documented dummy SECRET keys:
// 1x...AA always passes, 2x...AA always fails, 3x...AA yields "token already spent".
export const TS_PASS = '1x0000000000000000000000000000000AA';
export const TS_FAIL = '2x0000000000000000000000000000000AA';
export const TS_SPENT = '3x0000000000000000000000000000000AA';
export const DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

export class TurnstileStub {
  calls = 0;
  networkError = false;

  readonly handle = async (url: string, init: RequestInit | undefined): Promise<Response> => {
    if (url !== 'https://challenges.cloudflare.com/turnstile/v0/siteverify')
      throw new Error(`unexpected outbound host: ${new URL(url).host}`);
    this.calls++;
    if (this.networkError) throw new Error('network down');
    const form = new URLSearchParams(String(init?.body ?? ''));
    const secret = form.get('secret');
    const ok = secret === TS_PASS && Boolean(form.get('response'));
    const codes =
      secret === TS_SPENT ? ['timeout-or-duplicate'] : ok ? [] : ['invalid-input-response'];
    return new Response(JSON.stringify({ success: ok, 'error-codes': codes }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
}
