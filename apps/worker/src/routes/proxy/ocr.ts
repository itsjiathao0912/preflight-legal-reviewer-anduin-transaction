import type { Handler } from '../../app';
import { handleProxy, type ProxyContext } from '../../proxy/pipeline';

/** POST /api/ocr — contracts/ocr.ts envelope in (images only), NDJSON frames out. */
export function ocrHandler(ctx: ProxyContext): Handler {
  return (request, env) => handleProxy('ocr', request, env, ctx);
}
