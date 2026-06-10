import { describe, it, expect } from 'vitest'
import { paiseFromRupees, mrpSourceLabel } from '../src/lib/prices'

describe('paiseFromRupees', () => {
  it('parses valid rupee inputs to paise', () => {
    expect(paiseFromRupees('45')).toBe(4500)
    expect(paiseFromRupees('45.5')).toBe(4550)
    expect(paiseFromRupees('45.50')).toBe(4550)
    expect(paiseFromRupees('₹1,200')).toBe(120000)
    expect(paiseFromRupees('₹ 1,200.50')).toBe(120050)
    expect(paiseFromRupees('₹1,23,456')).toBe(12345600)
    expect(paiseFromRupees('Rs. 45')).toBe(4500)
    expect(paiseFromRupees('INR 1,23,456.75')).toBe(12345675)
    expect(paiseFromRupees('  12 ')).toBe(1200)
  })
  it('rejects invalid or non-positive inputs', () => {
    expect(paiseFromRupees('0')).toBeNull()
    expect(paiseFromRupees('abc')).toBeNull()
    expect(paiseFromRupees('')).toBeNull()
    expect(paiseFromRupees('45.999')).toBeNull() // 3 decimals
    expect(paiseFromRupees('-5')).toBeNull()
    expect(paiseFromRupees('1 2')).toBeNull()
    expect(paiseFromRupees('12,34')).toBeNull()
    expect(paiseFromRupees('₹₹12')).toBeNull()
    expect(paiseFromRupees('Rs. ₹12')).toBeNull()
  })
})

describe('mrpSourceLabel', () => {
  it('labels known sources and passes unknowns through', () => {
    expect(mrpSourceLabel('pack')).toBe('from pack')
    expect(mrpSourceLabel('brand')).toBe('brand')
    expect(mrpSourceLabel('gov')).toBe('govt (NPPA)')
    expect(mrpSourceLabel('other')).toBe('other')
    expect(mrpSourceLabel('weird')).toBe('weird')
  })
})
