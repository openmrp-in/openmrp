import { describe, it, expect } from 'vitest'
import { validateCreateProduct } from '../src/lib/validate'

describe('validateCreateProduct', () => {
  it('accepts a fully-populated payload (every optional field present)', () => {
    const { errors, value } = validateCreateProduct({
      brand: { name: 'Aachi', slug: 'aachi', manufacturer: 'Aachi Foods' },
      product: {
        name: 'Chilli Masala',
        group_key: 'aachi-chilli-masala',
        image_url: 'http://img',
        hsn_code: '0910',
        category: 'Spices',
        food_type: 'veg',
      },
      variants: [{ label: '100g', pack_size: 100, unit: 'g', barcode: '8904209301758', mrp_paise: 4500 }],
      names: [{ lang: 'ta', name: 'மிளகாய் தூள்' }],
    })
    expect(errors).toEqual([])
    expect(value.product.name).toBe('Chilli Masala')
    expect(value.brand?.manufacturer).toBe('Aachi Foods')
    expect(value.variants[0].barcode).toBe('8904209301758')
    expect(value.names[0].lang).toBe('ta')
  })

  it('accepts a minimal payload (only required fields) and defaults food_type', () => {
    const { errors, value } = validateCreateProduct({ product: { name: 'Plain' }, variants: [{}] })
    expect(errors).toEqual([])
    expect(value.product.food_type).toBe('none')
    expect(value.brand).toBeUndefined()
    expect(value.names).toEqual([])
  })

  it('accepts a brand with only a name (no slug/manufacturer)', () => {
    const { errors, value } = validateCreateProduct({
      brand: { name: 'Local Mill' },
      product: { name: 'Atta' },
      variants: [{ barcode: '111' }],
    })
    expect(errors).toEqual([])
    expect(value.brand?.name).toBe('Local Mill')
    expect(value.brand?.slug).toBeUndefined()
  })

  it('treats a null/non-object body as empty and flags the missing name', () => {
    const { errors } = validateCreateProduct(null)
    expect(errors).toContain('product.name is required')
  })

  it('requires product.name', () => {
    const { errors } = validateCreateProduct({ product: { food_type: 'veg' }, variants: [{}] })
    expect(errors).toContain('product.name is required')
  })

  it('requires variants to be a non-empty array (omitted)', () => {
    const { errors } = validateCreateProduct({ product: { name: 'X' } })
    expect(errors).toContain('at least one variant is required')
  })

  it('requires variants to be a non-empty array (empty array)', () => {
    const { errors } = validateCreateProduct({ product: { name: 'X' }, variants: [] })
    expect(errors).toContain('at least one variant is required')
  })

  it('rejects a negative mrp_paise', () => {
    const { errors } = validateCreateProduct({ product: { name: 'X' }, variants: [{ mrp_paise: -5 }] })
    expect(errors.some((e) => e.includes('mrp_paise'))).toBe(true)
  })

  it('rejects a non-integer mrp_paise', () => {
    const { errors } = validateCreateProduct({ product: { name: 'X' }, variants: [{ mrp_paise: 45.5 }] })
    expect(errors.some((e) => e.includes('mrp_paise'))).toBe(true)
  })

  it('rejects a non-number mrp_paise', () => {
    const { errors } = validateCreateProduct({ product: { name: 'X' }, variants: [{ mrp_paise: 'free' }] })
    expect(errors.some((e) => e.includes('mrp_paise'))).toBe(true)
  })

  it('rejects a non-string barcode', () => {
    const { errors } = validateCreateProduct({ product: { name: 'X' }, variants: [{ barcode: 123 }] })
    expect(errors.some((e) => e.includes('barcode'))).toBe(true)
  })

  it('rejects an unknown food_type', () => {
    const { errors } = validateCreateProduct({ product: { name: 'X', food_type: 'banana' }, variants: [{}] })
    expect(errors.some((e) => e.includes('food_type'))).toBe(true)
  })

  it('requires lang on each name entry', () => {
    const { errors } = validateCreateProduct({ product: { name: 'X' }, variants: [{}], names: [{ name: 'Y' }] })
    expect(errors.some((e) => e.includes('lang'))).toBe(true)
  })

  it('requires name on each name entry', () => {
    const { errors } = validateCreateProduct({ product: { name: 'X' }, variants: [{}], names: [{ lang: 'ta' }] })
    expect(errors.some((e) => e.includes('names[0].name'))).toBe(true)
  })

  it('requires brand.name when a brand object is provided', () => {
    const { errors } = validateCreateProduct({ brand: {}, product: { name: 'X' }, variants: [{}] })
    expect(errors).toContain('brand.name is required when brand is provided')
  })
})
