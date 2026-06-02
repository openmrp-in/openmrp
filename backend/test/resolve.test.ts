import { describe, it, expect } from 'vitest'
import { resolveBarcode } from '../src/resolve/resolve'
import type { ProductStore } from '../src/db/queries'
import type { ResolvedProduct } from '../src/db/schema'
import type { OffClient, OffSuggestion } from '../src/resolve/off'

const NOW = '2026-06-02T00:00:00.000Z'

function makeProduct(barcode: string): ResolvedProduct {
  return {
    product: {
      id: 'p1',
      brand_id: null,
      name: 'Aachi Chilli Masala',
      group_key: 'aachi-chilli-masala',
      image_url: '',
      hsn_code: '',
      category: 'Spices',
      food_type: 'veg',
      source: 'crowd',
      moderation_status: 'approved',
      created_at: NOW,
      updated_at: NOW,
    },
    variants: [
      {
        id: 'v1',
        product_id: 'p1',
        label: '100g',
        pack_size: 100,
        unit: 'g',
        barcode,
        mrp_paise: 4500,
        source: 'crowd',
        moderation_status: 'approved',
        created_at: NOW,
        updated_at: NOW,
      },
    ],
    names: [],
  }
}

function makeStore(byBarcode: ResolvedProduct | null): ProductStore {
  return {
    findByBarcode: async () => byBarcode,
    createProduct: async () => {
      throw new Error('not used in this test')
    },
  }
}

function makeOff(suggestion: OffSuggestion | null, calls?: { n: number }): OffClient {
  return {
    lookup: async () => {
      if (calls) calls.n++
      return suggestion
    },
  }
}

describe('resolveBarcode', () => {
  it('returns the crowd product on a DB hit and does not call OFF', async () => {
    const calls = { n: 0 }
    const res = await resolveBarcode(
      '8904209301758',
      makeStore(makeProduct('8904209301758')),
      makeOff(null, calls),
    )
    expect(res.found).toBe(true)
    expect(res.source).toBe('crowd')
    expect(res.product?.name).toBe('Aachi Chilli Masala')
    expect(res.variants?.[0].mrp_paise).toBe(4500)
    expect(res.names).toEqual([])
    expect(calls.n).toBe(0)
  })

  it('falls back to an OFF suggestion on a DB miss', async () => {
    const suggestion: OffSuggestion = {
      barcode: '3017620422003',
      name: 'Nutella',
      brand: 'Ferrero',
      image_url: 'http://img',
      quantity: '400 g',
    }
    const res = await resolveBarcode('3017620422003', makeStore(null), makeOff(suggestion))
    expect(res.found).toBe(true)
    expect(res.source).toBe('off')
    expect(res.off_suggestion?.name).toBe('Nutella')
    expect(res.product).toBeUndefined()
  })

  it('returns not-found when both sources miss', async () => {
    const res = await resolveBarcode('0000000000000', makeStore(null), makeOff(null))
    expect(res.found).toBe(false)
    expect(res.source).toBe('none')
  })

  it('short-circuits on an empty barcode without calling OFF', async () => {
    const calls = { n: 0 }
    const res = await resolveBarcode('   ', makeStore(null), makeOff(null, calls))
    expect(res.found).toBe(false)
    expect(res.source).toBe('none')
    expect(calls.n).toBe(0)
  })
})
