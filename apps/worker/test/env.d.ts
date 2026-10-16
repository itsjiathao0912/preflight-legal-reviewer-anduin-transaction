// Types the `env` exported by cloudflare:test with this Worker's bindings.
declare namespace Cloudflare {
  interface Env {
    ASSETS?: Fetcher;
    DB: D1Database;
    PAID_FALLBACK_ENABLED: string;
  }
}
