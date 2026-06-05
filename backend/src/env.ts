/** Bindings injected by the Cloudflare Workers runtime (see wrangler.toml). */
export interface Env {
  /** D1 database binding. */
  DB: D1Database
  /** Shared admin/super-admin key (set via `wrangler secret put`). */
  ADMIN_KEY: string
  /** HMAC secret for signing developer session JWTs. */
  JWT_SECRET: string
  /**
   * Base URL of a GEPIR (GS1 party registry) resolver, e.g. a thin proxy that
   * exposes `GET {base}/gtin/{gtin}` → `{ company_name, gln? }` (404 if unknown).
   * When empty, brand-ownership claims fall back to manual admin review.
   */
  GEPIR_BASE_URL: string
  /** R2 bucket holding the published ODbL data dump (json/csv/sql + manifest). */
  DUMP: R2Bucket
}
