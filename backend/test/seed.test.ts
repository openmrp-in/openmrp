import { describe, it, expect } from 'vitest'
import { clampFoodType, normalizeSeedItem, cacheItemToSeedItem } from '../src/lib/seed'

describe('clampFoodType', () => {
  it('keeps a known food type', () => expect(clampFoodType('veg')).toBe('veg'))
  it('defaults an unknown value to none', () => expect(clampFoodType('banana')).toBe('none'))
  it('defaults a non-string to none', () => expect(clampFoodType(undefined)).toBe('none'))
})

describe('normalizeSeedItem', () => {
  it('normalizes a fully-populated item (trims strings)', () => {
    const n = normalizeSeedItem({
      barcode: ' 890 ',
      name: ' Masala ',
      brand: ' Aachi ',
      pack_size: 100,
      unit: 'g',
      food_type: 'veg',
      group_key: 'aachi-masala',
    })
    expect(n).toEqual({
      barcode: '890',
      name: 'Masala',
      brand: 'Aachi',
      pack_size: 100,
      unit: 'g',
      food_type: 'veg',
      group_key: 'aachi-masala',
    })
  })

  it('defaults optionals and falls back group_key to name', () => {
    expect(normalizeSeedItem({ barcode: '1', name: 'Bare' })).toEqual({
      barcode: '1',
      name: 'Bare',
      brand: '',
      pack_size: 0,
      unit: '',
      food_type: 'none',
      group_key: 'Bare',
    })
  })

  it('returns null when barcode is missing', () => expect(normalizeSeedItem({ name: 'X' })).toBeNull())
  it('returns null when name is missing', () => expect(normalizeSeedItem({ barcode: '1' })).toBeNull())
  it('returns null for a non-object', () => expect(normalizeSeedItem(null)).toBeNull())
})

describe('cacheItemToSeedItem', () => {
  it('maps PascalCase cache keys to the snake_case wire shape', () => {
    expect(
      cacheItemToSeedItem({
        Barcode: '6111242100992',
        Name: 'Perly',
        Brand: 'Jaouda',
        PackSize: 100,
        Unit: 'g',
        FoodType: 'none',
        GroupKey: 'jaouda-perly',
      }),
    ).toEqual({
      barcode: '6111242100992',
      name: 'Perly',
      brand: 'Jaouda',
      pack_size: 100,
      unit: 'g',
      food_type: 'none',
      group_key: 'jaouda-perly',
    })
  })

  it('defaults missing cache fields', () => {
    expect(cacheItemToSeedItem({})).toEqual({
      barcode: '',
      name: '',
      brand: '',
      pack_size: 0,
      unit: '',
      food_type: 'none',
      group_key: '',
    })
  })
})
