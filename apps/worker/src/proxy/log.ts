// Redacting logger. ALL worker logging goes through this (reused by Phase 04b).
// Drops sensitive fields by name and scrubs any known secret value from every string.

const DROP = new Set([
  'authorization',
  'x-api-key',
  'cookie',
  'set-cookie',
  'x-aduin-turnstile',
  'body',
  'messages',
  'data_b64',
  'content',
  'headers',
  'apikey',
  'api_key',
  'secret',
  'token',
]);

export type LogSink = (line: string) => void;

export interface Logger {
  log(event: string, fields?: Record<string, unknown>): void;
}

function scrub(s: string, secrets: readonly string[]): string {
  let out = s;
  for (const sec of secrets) if (sec.length >= 8) out = out.split(sec).join('[REDACTED]');
  return out.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]');
}

export function redact(value: unknown, secrets: readonly string[], depth = 0): unknown {
  if (depth > 4) return '[DEPTH]';
  if (typeof value === 'string') return scrub(value.slice(0, 500), secrets);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, secrets, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = DROP.has(k.toLowerCase()) ? '[REDACTED]' : redact(v, secrets, depth + 1);
    }
    return out;
  }
  return undefined;
}

export function createLogger(sink: LogSink, secrets: readonly (string | undefined)[]): Logger {
  const s = secrets.filter((x): x is string => typeof x === 'string' && x.length > 0);
  return {
    log(event, fields = {}) {
      try {
        sink(JSON.stringify({ event: scrub(event, s), ...(redact(fields, s) as object) }));
      } catch {
        // logging must never break a request
      }
    },
  };
}
