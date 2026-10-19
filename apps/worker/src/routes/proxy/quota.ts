import { limits, QuotaResponseSchema, type QuotaResponse } from '@aduin/core';
import type { Handler } from '../../app';
import { type ProxyConfig } from '../../config';
import { nextUtcMidnightS } from '../../limits/clock';
import { usageKeys } from '../../limits/policy';
import { resolveVisitor, visitorSetCookie, type Visitor } from '../../limits/visitor';
import { errorResponse, jsonNoStore, ProxyError } from '../../proxy/errors';
import { checkClientHeader } from '../../proxy/guards';
import { configFor, type ProxyContext } from '../../proxy/pipeline';
import { ocrWorstCaseMicroUsd, providerFor } from '../../upstream/provider';

/**
 * Provider part of `global_ok`: false when AI_PROVIDER is invalid or the active provider's key is
 * missing; for the metered OpenAI provider also false when the lifetime spend headroom is below
 * one OCR page's worst case (one peek read). Spend numbers never reach the visitor body.
 */
async function providerOk(ctx: ProxyContext, cfg: ProxyConfig): Promise<boolean> {
  const provider = providerFor(cfg);
  if (!provider || !provider.apiKey(cfg)) return false;
  if (!provider.metered) return true;
  const spend = ctx.platform.spend;
  if (!spend) return false;
  try {
    return spend.cap() - (await spend.peek()) >= ocrWorstCaseMicroUsd();
  } catch {
    return false;
  }
}

/**
 * GET /api/quota — read-only (never claims, never writes). Fails soft: when config or the
 * platform is unavailable it answers `used` 0, the configured limits and `global_ok:false`.
 */
export function quotaHandler(ctx: ProxyContext): Handler {
  return async (request, env) => {
    try {
      checkClientHeader(request);
      const nowMs = ctx.now();
      const ra = ctx.preLimiter.hit(request, false, nowMs);
      if (ra !== null) throw new ProxyError('rate_limited', 'rate', ra);
      let cfg: ProxyConfig | undefined;
      try {
        cfg = configFor(env);
      } catch {
        cfg = undefined;
      }
      const resets_at = nextUtcMidnightS(nowMs);
      const body: QuotaResponse = {
        ai: { used: 0, limit: cfg?.visitorAiDocsPerDay ?? limits.visitorAiDocsPerDay, resets_at },
        ocr_pages: {
          used: 0,
          limit: cfg?.visitorOcrPagesPerDay ?? limits.visitorOcrPagesPerDay,
          resets_at,
        },
        global_ok: false,
      };
      let visitor: Visitor | null = null;
      if (cfg) {
        visitor = await resolveVisitor(request, cfg, nowMs);
        if (visitor) {
          try {
            const u = await ctx.platform
              .quota(usageKeys(visitor.claims.v, visitor.ipHash, nowMs))
              .usage();
            body.ai.used = u.ai.used;
            body.ocr_pages.used = u.ocr_pages.used;
            body.global_ok = u.global_ok && cfg.uploadsEnabled && (await providerOk(ctx, cfg));
          } catch {
            // platform unavailable: keep the fail-soft defaults
          }
        }
      }
      const headers: Record<string, string> = {};
      if (visitor && cfg) {
        const c = await visitorSetCookie(visitor, cfg).catch(() => null);
        if (c) headers['set-cookie'] = c;
      }
      return jsonNoStore(QuotaResponseSchema.parse(body), headers);
    } catch (e) {
      if (e instanceof ProxyError) return errorResponse(e);
      return errorResponse(new ProxyError('memory_unavailable', 'quota'));
    }
  };
}
