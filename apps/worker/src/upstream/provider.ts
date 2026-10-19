// Provider seam (OpenAI provider plan, M1/M3). `providerFor(cfg)` picks the AI/OCR upstream from
// AI_PROVIDER: `openrouter` delegates to the existing OpenRouter functions unchanged (byte-identical
// bodies, free-only models, paid fallback stays in the pipeline), `openai` is the direct
// gpt-4.1-mini provider (metered against the lifetime spend counter). `invalid` -> null: the
// pipeline refuses AI/OCR before any port call.
import type { AiResponseMode, LlmTask } from '@aduin/core';
import type { ProxyConfig } from '../config';
import type { Classified } from './classify';
import { freeModelsFor, servedTier, type ProxyKind } from './models-config';
import {
  buildOpenAiBody,
  callOpenAi,
  checkServedOpenAi,
  classifyOpenAiError,
  normalizeOcr,
  openAiOcrResponseFormat,
  openAiResponseFormat,
  OPENAI_MODEL,
  worstCaseMicroUsd,
} from './openai';
import {
  aiResponseFormat,
  buildBody,
  callOpenRouter,
  ocrMessages,
  ocrResponseFormat,
} from './openrouter';

export type ServedVerdict = 'ok' | 'trip' | 'unknown';

export interface Provider {
  id: 'openrouter' | 'openai';
  /** true: every call reserves worst-case cost against the lifetime spend counter */
  metered: boolean;
  /** the provider's secret, if set (missing -> AI/OCR off before any claim) */
  apiKey(cfg: ProxyConfig): string | undefined;
  /** primary model id (cache key + body) */
  modelFor(kind: ProxyKind): string;
  buildBody(kind: ProxyKind, messagesJson: string, responseFormatJson: string): string;
  call(fetchFn: typeof fetch, body: string, signal: AbortSignal): Promise<Response>;
  responseFormat: { ai(task: LlmTask, mode: AiResponseMode): string; ocr(): string };
  normalizeOcr?: (raw: unknown) => unknown;
  /** breaker verdict for a successful reply */
  checkServed(model: string, costUsd: number): ServedVerdict;
  classifyError?: (res: Response) => Promise<Classified | undefined>;
}

function openRouterProvider(cfg: ProxyConfig): Provider {
  return {
    id: 'openrouter',
    metered: false,
    apiKey: (c) => c.apiKey,
    modelFor: (kind) => freeModelsFor(kind, cfg)[0]!,
    buildBody: (kind, m, rf) => buildBody(kind, freeModelsFor(kind, cfg), m, rf),
    call: (fetchFn, body, signal) => callOpenRouter(fetchFn, cfg, body, signal),
    responseFormat: { ai: aiResponseFormat, ocr: ocrResponseFormat },
    // the breaker is only judged while paid is disabled (unchanged behaviour)
    checkServed: (model, costUsd) => {
      if (cfg.paidEnabled) return 'ok';
      const tier = servedTier(model, costUsd, cfg);
      return tier === 'paid' ? 'trip' : tier === 'unknown' ? 'unknown' : 'ok';
    },
  };
}

function openAiProvider(cfg: ProxyConfig): Provider {
  return {
    id: 'openai',
    metered: true,
    apiKey: (c) => c.openaiApiKey,
    modelFor: () => OPENAI_MODEL,
    buildBody: buildOpenAiBody,
    call: (fetchFn, body, signal) => callOpenAi(fetchFn, cfg, body, signal),
    responseFormat: { ai: openAiResponseFormat, ocr: openAiOcrResponseFormat },
    normalizeOcr,
    checkServed: (model) => checkServedOpenAi(model),
    classifyError: classifyOpenAiError,
  };
}

let ocrWorst: number | undefined;
/** Worst-case OpenAI cost of one OCR page (one image); `/api/quota` keeps this much headroom. */
export function ocrWorstCaseMicroUsd(): number {
  ocrWorst ??= worstCaseMicroUsd(
    'ocr',
    ocrMessages({ mime: 'image/png', pages: [{ index: 0, data_b64: 'AAAA' }] }),
    openAiOcrResponseFormat(),
  );
  return ocrWorst;
}

/** The active provider, or null when AI_PROVIDER is missing/invalid (AI/OCR off). */
export function providerFor(cfg: ProxyConfig): Provider | null {
  if (cfg.aiProvider === 'openrouter') return openRouterProvider(cfg);
  if (cfg.aiProvider === 'openai') return openAiProvider(cfg);
  return null;
}
