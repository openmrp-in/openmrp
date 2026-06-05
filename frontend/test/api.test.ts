import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  getProduct,
  search,
  listBrands,
  productsByBrand,
  rupees,
  foodTypeLabel,
  getDumpManifest,
  dumpFileUrl,
  humanBytes,
} from '../src/lib/api'

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }))
}

afterEach(() => vi.restoreAllMocks())

describe('rupees', () => {
  it('formats paise as INR', () => {
    const out = rupees(4500)
    expect(out).toContain('45')
    expect(out).toContain('₹')
  })
})

describe('foodTypeLabel', () => {
  it('maps a known food type', () => expect(foodTypeLabel('veg')).toBe('Veg'))
  it('passes through an unknown food type', () => expect(foodTypeLabel('xyz')).toBe('xyz'))
})

describe('getProduct', () => {
  it('returns the parsed body on 200', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { found: true, source: 'crowd', product: { name: 'X' } }))
    expect((await getProduct('123')).found).toBe(true)
  })
  it('returns a clean not-found on 404', async () => {
    vi.stubGlobal('fetch', mockFetch(404, {}))
    expect(await getProduct('123')).toEqual({ found: false, source: 'none' })
  })
  it('throws on other errors', async () => {
    vi.stubGlobal('fetch', mockFetch(500, {}))
    await expect(getProduct('123')).rejects.toThrow()
  })
})

describe('search', () => {
  it('returns results on ok', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { results: [{ barcode: '1', name: 'A' }] }))
    expect(await search('aa')).toHaveLength(1)
  })
  it('returns [] on error', async () => {
    vi.stubGlobal('fetch', mockFetch(500, {}))
    expect(await search('aa')).toEqual([])
  })
})

describe('listBrands', () => {
  it('returns brands on ok', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { brands: [{ slug: 'a', name: 'A', product_count: 2 }] }))
    expect(await listBrands()).toHaveLength(1)
  })
  it('returns [] on error', async () => {
    vi.stubGlobal('fetch', mockFetch(503, {}))
    expect(await listBrands()).toEqual([])
  })
})

describe('productsByBrand', () => {
  it('returns results on ok', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { results: [{ barcode: '1', name: 'A' }] }))
    expect(await productsByBrand('a')).toHaveLength(1)
  })
  it('returns [] on error', async () => {
    vi.stubGlobal('fetch', mockFetch(404, {}))
    expect(await productsByBrand('a')).toEqual([])
  })
})

describe('dump', () => {
  it('returns the manifest on 200 and null otherwise', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { license: 'ODbL-1.0', files: [] }))
    expect((await getDumpManifest())?.license).toBe('ODbL-1.0')
    vi.stubGlobal('fetch', mockFetch(404, {}))
    expect(await getDumpManifest()).toBeNull()
  })

  it('builds a file download URL', () => {
    expect(dumpFileUrl('products.csv')).toContain('/v1/dump/file/products.csv')
  })

  it('formats byte sizes', () => {
    expect(humanBytes(500)).toBe('500 B')
    expect(humanBytes(2048)).toBe('2.0 KB')
    expect(humanBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(humanBytes(3 * 1024 ** 3)).toBe('3.0 GB')
    expect(humanBytes(5 * 1024 ** 4)).toBe('5120.0 GB') // clamps at GB
  })
})
