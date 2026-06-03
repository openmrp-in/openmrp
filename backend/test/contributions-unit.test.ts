import { env } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'
import { createContributionsStore } from '../src/db/contributions'

// The HTTP routes pre-fetch the row, so the store's own not-found guards are
// exercised here directly against the public store API.
describe('contributions store guards', () => {
  it("reject() returns 'not_found' for a missing contribution", async () => {
    const store = createContributionsStore(env.DB)
    expect(await store.reject('no-such', 'admin', '2026-01-01T00:00:00.000Z')).toBe('not_found')
  })

  it("approve() returns not_found for a missing contribution", async () => {
    const store = createContributionsStore(env.DB)
    expect(await store.approve('no-such', 'someone', '2026-01-01T00:00:00.000Z')).toEqual({ ok: false, reason: 'not_found' })
  })

  it('get() returns null for a missing contribution', async () => {
    const store = createContributionsStore(env.DB)
    expect(await store.get('no-such')).toBeNull()
  })
})
