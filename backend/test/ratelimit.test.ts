import { env } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'
import { rateLimit } from '../src/lib/ratelimit'

describe('rateLimit', () => {
  it('allows up to the limit, then blocks', async () => {
    const now = 1_000_000
    expect(await rateLimit(env.DB, 'sub-a', 2, 60_000, now)).toMatchObject({ ok: true, remaining: 1 })
    expect(await rateLimit(env.DB, 'sub-a', 2, 60_000, now)).toMatchObject({ ok: true, remaining: 0 })
    const r3 = await rateLimit(env.DB, 'sub-a', 2, 60_000, now)
    expect(r3.ok).toBe(false)
    expect(r3.remaining).toBe(0)
  })
  it('resets in a new window', async () => {
    expect((await rateLimit(env.DB, 'sub-b', 1, 60_000, 2_000_000)).ok).toBe(true)
    expect((await rateLimit(env.DB, 'sub-b', 1, 60_000, 2_060_000)).ok).toBe(true)
  })
})
