/** Bindings injected by the Cloudflare Workers runtime (see wrangler.toml). */
export interface Env {
  /** D1 database binding. */
  DB: D1Database
  /** Shared admin key gating write endpoints (set via `wrangler secret put`). */
  ADMIN_KEY: string
}
