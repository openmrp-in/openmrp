import { describe, it, expect } from 'vitest'
import { toHex, fromHex, sha256Hex } from '../src/lib/hex'

describe('hex', () => {
  it('round-trips bytes', () => {
    const bytes = new Uint8Array([0, 1, 15, 16, 255])
    expect(fromHex(toHex(bytes))).toEqual(bytes)
  })
  it('encodes known values', () => {
    expect(toHex(new Uint8Array([0, 255, 16]))).toBe('00ff10')
  })
  it('sha256Hex matches the known empty-input vector', async () => {
    expect(await sha256Hex(new Uint8Array())).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })
})
