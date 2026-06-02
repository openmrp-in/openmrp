import { describe, it, expect } from 'vitest'
import { ulid } from '../src/lib/ulid'

describe('ulid', () => {
  it('produces a 26-char Crockford base32 id', () => {
    const id = ulid()
    expect(id).toHaveLength(26)
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
  })

  it('encodes the timestamp in the first 10 chars (time-sortable)', () => {
    const earlier = ulid(1000)
    const later = ulid(2_000_000)
    expect(earlier.slice(0, 10) <= later.slice(0, 10)).toBe(true)
  })

  it('generates distinct ids', () => {
    expect(ulid()).not.toBe(ulid())
  })
})
