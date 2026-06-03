import { describe, it, expect } from 'vitest'
import { toHex, fromHex } from '../src/lib/hex'

describe('hex', () => {
  it('round-trips bytes', () => {
    const bytes = new Uint8Array([0, 1, 15, 16, 255])
    expect(fromHex(toHex(bytes))).toEqual(bytes)
  })
  it('encodes known values', () => {
    expect(toHex(new Uint8Array([0, 255, 16]))).toBe('00ff10')
  })
})
