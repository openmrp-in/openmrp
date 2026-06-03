/** Bindings injected by the Cloudflare Workers runtime (see wrangler.toml). */
export interface Env {
  /** D1 database binding. */
  DB: D1Database
  /** Shared admin/super-admin key (set via `wrangler secret put`). */
  ADMIN_KEY: string
  /** HMAC secret for signing developer session JWTs. */
  JWT_SECRET: string
}
