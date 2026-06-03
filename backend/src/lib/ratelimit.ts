export interface RateLimitResult {
  ok: boolean
  limit: number
  remaining: number
  /** Epoch ms when the current window resets. */
  resetAt: number
}

/**
 * Fixed-window rate limiter backed by D1. One row per (subject, window); the count
 * is incremented atomically via UPSERT...RETURNING. Simple + durable + testable;
 * can be swapped for Cloudflare's native rate-limit binding at scale.
 */
export async function rateLimit(
  db: D1Database,
  subject: string,
  limit: number,
  windowMs: number,
  now: number,
): Promise<RateLimitResult> {
  const windowStart = Math.floor(now / windowMs) * windowMs
  const resetAt = windowStart + windowMs
  const row = await db
    .prepare(
      'INSERT INTO rate_buckets (bucket, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET count = count + 1 RETURNING count',
    )
    .bind(`${subject}:${windowStart}`, resetAt)
    .first<{ count: number }>()
  const count = row!.count
  return { ok: count <= limit, limit, remaining: Math.max(0, limit - count), resetAt }
}
