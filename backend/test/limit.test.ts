import { describe, it, expect } from 'vitest'
import { clampLimit } from '../src/lib/limit'

describe('clampLimit', () => {
  it('defaults when absent', () => expect(clampLimit(undefined, 30, 100)).toBe(30))
  it('defaults when <= 0', () => expect(clampLimit('0', 30, 100)).toBe(30))
  it('defaults when non-numeric', () => expect(clampLimit('abc', 30, 100)).toBe(30))
  it('returns the value when valid', () => expect(clampLimit('5', 30, 100)).toBe(5))
  it('caps at max', () => expect(clampLimit('99999', 30, 100)).toBe(100))
})
