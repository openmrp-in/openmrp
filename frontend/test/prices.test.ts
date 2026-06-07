import { describe, it, expect } from 'vitest'
import { paiseFromRupees, mrpSourceLabel } from '../src/lib/prices'

describe('paiseFromRupees', () => {
  it('parses valid rupee inputs to paise', () => {
    expect(paiseFromRupees('45')).toBe(4500)
    expect(paiseFromRupees('45.5')).toBe(4550)
    expect(paiseFromRupees('45.50')).toBe(4550)
    expect(paiseFromRupees('₹1,200')).toBe(120000)
    expect(paiseFromRupees('  12 ')).toBe(1200)
  })
  it('rejects invalid or non-positive inputs', () => {
    expect(paiseFromRupees('0')).toBeNull()
    expect(paiseFromRupees('abc')).toBeNull()
    expect(paiseFromRupees('')).toBeNull()
    expect(paiseFromRupees('45.999')).toBeNull() // 3 decimals
    expect(paiseFromRupees('-5')).toBeNull()
  })
})

describe('mrpSourceLabel', () => {
  it('labels known sources and passes unknowns through', () => {
    expect(mrpSourceLabel('pack')).toBe('from pack')
    expect(mrpSourceLabel('brand')).toBe('brand')
    expect(mrpSourceLabel('other')).toBe('other')
    expect(mrpSourceLabel('weird')).toBe('weird')
  })
})
