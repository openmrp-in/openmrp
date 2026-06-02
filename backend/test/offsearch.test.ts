import { describe, it, expect } from 'vitest'
import {
  buildSearchUrl,
  parseQuantity,
  foodTypeFromLabels,
  truncate,
  gs1CheckDigit,
  validBarcode,
  mapOffProduct,
} from '../src/lib/offsearch'

describe('buildSearchUrl', () => {
  it('builds an India search URL with the expected params', () => {
    const url = buildSearchUrl(3, 100)
    expect(url).toContain('/api/v2/search?')
    expect(url).toContain('countries_tags=en%3Aindia')
    expect(url).toContain('sort_by=unique_scans_n')
    expect(url).toContain('page=3')
    expect(url).toContain('page_size=100')
  })
})

describe('parseQuantity', () => {
  it('parses a value with a unit synonym', () => expect(parseQuantity('200 grams')).toEqual([200, 'g']))
  it('parses a comma decimal and passes through an unknown unit', () =>
    expect(parseQuantity('1,5 kg')).toEqual([1.5, 'kg']))
  it('parses a value with no unit', () => expect(parseQuantity('5')).toEqual([5, '']))
  it('returns [0, ""] when nothing matches', () => expect(parseQuantity('abc')).toEqual([0, '']))
})

describe('foodTypeFromLabels', () => {
  it('detects non-veg (hyphenated)', () => expect(foodTypeFromLabels(['en:non-vegetarian'])).toBe('non-veg'))
  it('detects non-veg (short form)', () => expect(foodTypeFromLabels(['en:non-veg'])).toBe('non-veg'))
  it('detects egg', () => expect(foodTypeFromLabels(['en:contains-eggs'])).toBe('egg'))
  it('detects veg (vegan)', () => expect(foodTypeFromLabels(['en:vegan'])).toBe('veg'))
  it('detects veg (vegetarian)', () => expect(foodTypeFromLabels(['en:vegetarian'])).toBe('veg'))
  it('non-veg wins over veg (precedence)', () =>
    expect(foodTypeFromLabels(['en:vegan', 'en:non-vegetarian'])).toBe('non-veg'))
  it('egg wins over veg (precedence)', () =>
    expect(foodTypeFromLabels(['en:vegetarian', 'en:contains-egg'])).toBe('egg'))
  it('defaults to none on unrelated labels', () => expect(foodTypeFromLabels(['en:gluten-free'])).toBe('none'))
  it('defaults to none on empty labels', () => expect(foodTypeFromLabels([])).toBe('none'))
})

describe('truncate', () => {
  it('returns the string when within max', () => expect(truncate('abc', 5)).toBe('abc'))
  it('caps the string when over max', () => expect(truncate('abcdef', 3)).toBe('abc'))
})

describe('gs1CheckDigit / validBarcode', () => {
  it('accepts a structurally valid barcode', () => {
    const body = '890604963622'
    const code = body + String(gs1CheckDigit(body))
    expect(validBarcode(code)).toBe(true)
  })
  it('rejects a wrong length', () => expect(validBarcode('123456')).toBe(false))
  it('rejects non-digits', () => expect(validBarcode('1234567a')).toBe(false))
  it('rejects a wrong check digit', () => {
    const body = '890604963622'
    const wrong = body + String((gs1CheckDigit(body) + 1) % 10)
    expect(validBarcode(wrong)).toBe(false)
  })
})

describe('mapOffProduct', () => {
  it('maps a full product', () => {
    expect(
      mapOffProduct({
        code: ' 6111242100992 ',
        product_name: ' Perly ',
        brands: 'Jaouda, Other',
        quantity: '100 g',
        labels_tags: ['en:vegetarian'],
      }),
    ).toEqual({
      Barcode: '6111242100992',
      Name: 'Perly',
      Brand: 'Jaouda',
      PackSize: 100,
      Unit: 'g',
      FoodType: 'veg',
      GroupKey: 'jaouda-perly',
    })
  })

  it('drops a junk quantity with an overlong unit', () => {
    const m = mapOffProduct({ code: '1', product_name: 'X', quantity: '5 abcdefghijklm' })
    expect(m.PackSize).toBe(0)
    expect(m.Unit).toBe('')
  })

  it('drops an absurd pack size', () => {
    const m = mapOffProduct({ code: '1', product_name: 'X', quantity: '2000000 g' })
    expect(m.PackSize).toBe(0)
  })

  it('defaults missing brand/labels', () => {
    const m = mapOffProduct({ code: '1', product_name: 'Plain' })
    expect(m.Brand).toBe('')
    expect(m.FoodType).toBe('none')
  })

  it('handles a completely empty product', () => {
    expect(mapOffProduct({})).toMatchObject({
      Barcode: '',
      Name: '',
      Brand: '',
      PackSize: 0,
      Unit: '',
      FoodType: 'none',
    })
  })
})
