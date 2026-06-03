import { describe, it, expect } from 'vitest'
import { validateCreateProduct } from '../src/lib/validate'

describe('validateCreateProduct', () => {
  it('accepts a fully-populated payload (all fields + translations)', () => {
    const { errors, value } = validateCreateProduct({
      brand: {
        name: 'Aachi',
        slug: 'aachi',
        manufacturer: 'Aachi Foods',
        description: 'Masala brand',
        translations: [{ lang: 'ta', name: 'ஆச்சி', description: 'மசாலா' }],
      },
      product: {
        name: 'Chilli Masala',
        group_key: 'aachi-chilli-masala',
        image_url: 'http://i',
        hsn_code: '0910',
        category: 'Spices',
        food_type: 'veg',
        description: 'Spicy',
        ingredients: 'Chilli, salt',
      },
      variants: [{ label: '100g', pack_size: 100, unit: 'g', barcode: '8904209301758', mrp_paise: 4500 }],
      translations: [{ lang: 'ta', name: 'மிளகாய்', description: 'காரம்', ingredients: 'மிளகாய்' }],
    })
    expect(errors).toEqual([])
    expect(value.product.description).toBe('Spicy')
    expect(value.product.ingredients).toBe('Chilli, salt')
    expect(value.brand?.description).toBe('Masala brand')
    expect(value.brand?.translations[0].name).toBe('ஆச்சி')
    expect(value.translations[0].ingredients).toBe('மிளகாய்')
  })

  it('accepts a minimal payload and defaults all text fields', () => {
    const { errors, value } = validateCreateProduct({ product: { name: 'Plain' }, variants: [{}] })
    expect(errors).toEqual([])
    expect(value.product.food_type).toBe('none')
    expect(value.product.description).toBe('')
    expect(value.product.ingredients).toBe('')
    expect(value.brand).toBeUndefined()
    expect(value.translations).toEqual([])
  })

  it('accepts a brand with only a name (no slug/translations)', () => {
    const { errors, value } = validateCreateProduct({
      brand: { name: 'Local Mill' },
      product: { name: 'Atta' },
      variants: [{ barcode: '111' }],
    })
    expect(errors).toEqual([])
    expect(value.brand?.description).toBe('')
    expect(value.brand?.translations).toEqual([])
    expect(value.brand?.slug).toBeUndefined()
  })

  it('treats a null body as empty and flags the missing name', () => {
    expect(validateCreateProduct(null).errors).toContain('product.name is required')
  })

  it('requires product.name', () => {
    expect(validateCreateProduct({ product: { food_type: 'veg' }, variants: [{}] }).errors).toContain('product.name is required')
  })

  it('requires a non-empty variants array (omitted)', () => {
    expect(validateCreateProduct({ product: { name: 'X' } }).errors).toContain('at least one variant is required')
  })

  it('requires a non-empty variants array (empty)', () => {
    expect(validateCreateProduct({ product: { name: 'X' }, variants: [] }).errors).toContain('at least one variant is required')
  })

  it('rejects a negative mrp_paise', () => {
    expect(validateCreateProduct({ product: { name: 'X' }, variants: [{ mrp_paise: -5 }] }).errors.some((e) => e.includes('mrp_paise'))).toBe(true)
  })

  it('rejects a non-integer mrp_paise', () => {
    expect(validateCreateProduct({ product: { name: 'X' }, variants: [{ mrp_paise: 4.5 }] }).errors.some((e) => e.includes('mrp_paise'))).toBe(true)
  })

  it('rejects a non-number mrp_paise', () => {
    expect(validateCreateProduct({ product: { name: 'X' }, variants: [{ mrp_paise: 'free' }] }).errors.some((e) => e.includes('mrp_paise'))).toBe(true)
  })

  it('rejects a non-string barcode', () => {
    expect(validateCreateProduct({ product: { name: 'X' }, variants: [{ barcode: 123 }] }).errors.some((e) => e.includes('barcode'))).toBe(true)
  })

  it('rejects an unknown food_type', () => {
    expect(validateCreateProduct({ product: { name: 'X', food_type: 'banana' }, variants: [{}] }).errors.some((e) => e.includes('food_type'))).toBe(true)
  })

  it('requires lang on each product translation', () => {
    expect(
      validateCreateProduct({ product: { name: 'X' }, variants: [{}], translations: [{ name: 'Y' }] }).errors.some((e) =>
        e.includes('translations[0].lang'),
      ),
    ).toBe(true)
  })

  it('requires brand.name when a brand is provided', () => {
    expect(validateCreateProduct({ brand: {}, product: { name: 'X' }, variants: [{}] }).errors).toContain(
      'brand.name is required when brand is provided',
    )
  })

  it('requires lang on each brand translation', () => {
    expect(
      validateCreateProduct({
        brand: { name: 'B', translations: [{ name: 'Y' }] },
        product: { name: 'X' },
        variants: [{}],
      }).errors.some((e) => e.includes('brand.translations[0].lang')),
    ).toBe(true)
  })
})
