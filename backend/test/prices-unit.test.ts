import { env } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'
import { createPricesStore } from '../src/db/prices'

// The HTTP routes pre-fetch the report, so the store's own not-found guards are
// exercised here directly.
describe('prices store guards', () => {
  it("reject() returns 'not_found' for a missing report", async () => {
    expect(await createPricesStore(env.DB).reject('no-such', 'admin', '2026-01-01T00:00:00.000Z')).toBe('not_found')
  })
  it('approve() returns not_found for a missing report', async () => {
    expect(await createPricesStore(env.DB).approve('no-such', 'someone', '2026-01-01T00:00:00.000Z')).toEqual({ ok: false, reason: 'not_found' })
  })
  it('get() returns null for a missing report', async () => {
    expect(await createPricesStore(env.DB).get('no-such')).toBeNull()
  })
  it('findVariant() returns null for an unknown barcode', async () => {
    expect(await createPricesStore(env.DB).findVariant('does-not-exist')).toBeNull()
  })
})
