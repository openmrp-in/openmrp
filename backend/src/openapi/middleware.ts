import { verify } from 'hono/jwt'
import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from './app'
import { createAccountsStore } from '../db/accounts'
import { hashSecret, parseApiKey } from '../lib/apikey'
import { rateLimit } from '../lib/ratelimit'

const READ_RATE_LIMIT = 60 // requests per minute per key
const RATE_WINDOW_MS = 60_000

/**
 * Require a valid `X-Api-Key` on read endpoints, then rate-limit per key.
 * 401 if missing/invalid/revoked, 429 over the limit (with RateLimit-* headers).
 */
export const apiKeyAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const parsed = parseApiKey(c.req.header('X-Api-Key') ?? '')
  if (!parsed) return c.json({ error: 'api_key_required' }, 401)

  const accounts = createAccountsStore(c.env.DB)
  const key = await accounts.findApiKeyByPrefix(parsed.prefix)
  if (!key || key.revoked !== 0) return c.json({ error: 'invalid_api_key' }, 401)
  if ((await hashSecret(parsed.secret)) !== key.key_hash) return c.json({ error: 'invalid_api_key' }, 401)

  const now = Date.now()
  const rl = await rateLimit(c.env.DB, key.id, READ_RATE_LIMIT, RATE_WINDOW_MS, now)
  c.header('RateLimit-Limit', String(rl.limit))
  c.header('RateLimit-Remaining', String(rl.remaining))
  if (!rl.ok) {
    c.header('Retry-After', String(Math.ceil((rl.resetAt - now) / 1000)))
    return c.json({ error: 'rate_limited' }, 429)
  }

  await accounts.recordKeyUsage(key.id, new Date(now).toISOString())
  await next()
}

/** Verify the developer session JWT (Authorization: Bearer …) and set developerId. */
export const developerAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return c.json({ error: 'unauthorized' }, 401)
  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256')
    c.set('developerId', String(payload.sub))
  } catch {
    return c.json({ error: 'unauthorized' }, 401)
  }
  await next()
}
