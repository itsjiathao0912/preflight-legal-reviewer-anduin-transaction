import type { AiCandidate } from '@aduin/core';
import { apiUrl } from '../../api/base';
import { clientHeaders, DOC_HEADER, TURNSTILE_HEADER } from '../../api/http';
import { postNdjson, type StreamTerminal } from '../../api/ndjson';
import { turnstileToken } from './turnstile';

/**
 * AI stream client: POST /api/ai (task, law_firm_id, candidates) with `x-aduin-client: 1`,
 * `x-aduin-doc` and the optional Turnstile header; reads NDJSON frames through the shared api/ client.
 * One call per request: no auto-retry (manual Retry in the lane), abort supported.
 */
export interface AiCall {
  docHash: string;
  lawFirmId: string | null;
  candidates: AiCandidate[];
  signal?: AbortSignal;
}

export async function requestAi(call: AiCall): Promise<StreamTerminal> {
  const url = apiUrl('api/ai');
  if (!url) {
    return {
      kind: 'error',
      error: { code: 'quota_exhausted', reason: 'ai_unavailable', message: 'AI is not connected.' },
    };
  }
  const token = await turnstileToken();
  const headers = clientHeaders({
    [DOC_HEADER]: call.docHash,
    ...(token ? { [TURNSTILE_HEADER]: token } : {}),
  });
  return postNdjson(
    url,
    {
      v: 1,
      task: 'clause-judgment',
      law_firm_id: call.lawFirmId,
      candidates: call.candidates,
      settings: {},
    },
    { headers, ...(call.signal ? { signal: call.signal } : {}) },
  );
}
