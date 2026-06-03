import { SELF, fetchMock } from 'cloudflare:test'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

const BASE = 'https://openmrp.test'
const ADMIN = { 'X-Admin-Key': 'test-admin-key', 'content-type': 'application/json' }

function productBody(barcode: string, overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    brand: { name: 'Aachi' },
    product: { name: 'Chilli Masala', food_type: 'veg', category: 'Spices' },
    variants: [{ label: '100g', pack_size: 100, unit: 'g', barcode, mrp_paise: 4500 }],
    names: [{ lang: 'ta', name: 'மிளகாய்' }],
    ...overrides,
  })
}

describe('routes (integration, real D1)', () => {
  it('GET /health → 200', async () => {
    const res = await SELF.fetch(`${BASE}/health`)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'ok' })
  })

  it('unknown route → 404', async () => {
    const res = await SELF.fetch(`${BASE}/nope`)
    expect(res.status).toBe(404)
  })

  it('POST without admin key → 401', async () => {
    const res = await SELF.fetch(`${BASE}/v1/products`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    expect(res.status).toBe(401)
  })

  it('POST with invalid JSON → 400', async () => {
    const res = await SELF.fetch(`${BASE}/v1/products`, { method: 'POST', headers: ADMIN, body: 'not json' })
    expect(res.status).toBe(400)
  })

  it('POST with an invalid body → 422', async () => {
    const res = await SELF.fetch(`${BASE}/v1/products`, {
      method: 'POST',
      headers: ADMIN,
      body: JSON.stringify({ variants: [] }),
    })
    expect(res.status).toBe(422)
    expect(((await res.json()) as { error: string }).error).toBe('validation_failed')
  })

  it('POST creates a product, then GET resolves it (crowd, flattened shape)', async () => {
    const barcode = '8904209301758'
    const post = await SELF.fetch(`${BASE}/v1/products`, { method: 'POST', headers: ADMIN, body: productBody(barcode) })
    expect(post.status).toBe(201)
    const created = (await post.json()) as {
      created: boolean
      product: { name: string }
      variants: { mrp_paise: number }[]
      names: { name: string }[]
    }
    expect(created.created).toBe(true)
    expect(created.product.name).toBe('Chilli Masala')
    expect(created.variants[0].mrp_paise).toBe(4500)
    expect(created.names[0].name).toBe('மிளகாய்')

    const get = await SELF.fetch(`${BASE}/v1/product/${barcode}`)
    expect(get.status).toBe(200)
    const body = (await get.json()) as {
      found: boolean
      source: string
      product: { name: string }
      variants: { barcode: string }[]
      names: { lang: string }[]
    }
    expect(body).toMatchObject({ found: true, source: 'crowd' })
    expect(body.product.name).toBe('Chilli Masala')
    expect(body.variants[0].barcode).toBe(barcode)
    expect(body.names[0].lang).toBe('ta')
  })

  it('POST a duplicate barcode → 409', async () => {
    const barcode = '8901058000986'
    const first = await SELF.fetch(`${BASE}/v1/products`, { method: 'POST', headers: ADMIN, body: productBody(barcode) })
    expect(first.status).toBe(201)
    const dup = await SELF.fetch(`${BASE}/v1/products`, { method: 'POST', headers: ADMIN, body: productBody(barcode) })
    expect(dup.status).toBe(409)
    expect(((await dup.json()) as { error: string }).error).toBe('conflict')
  })

  it('reuses an existing brand for a second product (existing-brand path)', async () => {
    const a = await SELF.fetch(`${BASE}/v1/products`, { method: 'POST', headers: ADMIN, body: productBody('2000000000001') })
    expect(a.status).toBe(201)
    // same brand 'Aachi', different product/barcode → brand row reused, not duplicated
    const b = await SELF.fetch(`${BASE}/v1/products`, {
      method: 'POST',
      headers: ADMIN,
      body: productBody('2000000000002', { product: { name: 'Sambar Powder', food_type: 'veg' } }),
    })
    expect(b.status).toBe(201)
  })

  it('creates a product with no brand', async () => {
    const res = await SELF.fetch(`${BASE}/v1/products`, {
      method: 'POST',
      headers: ADMIN,
      body: productBody('3000000000003', { brand: undefined }),
    })
    expect(res.status).toBe(201)
  })

  it('creates a fully-specified product (all optional fields present)', async () => {
    const res = await SELF.fetch(`${BASE}/v1/products`, {
      method: 'POST',
      headers: ADMIN,
      body: JSON.stringify({
        brand: { name: 'FullBrand', slug: 'full-brand', manufacturer: 'Full Co' },
        product: {
          name: 'Full Product',
          group_key: 'full-product',
          image_url: 'http://i',
          hsn_code: '0910',
          category: 'Spices',
          food_type: 'veg',
        },
        variants: [{ label: '1kg', pack_size: 1000, unit: 'g', barcode: '4000000000001', mrp_paise: 9900 }],
        names: [{ lang: 'hi', name: 'पूरा' }],
      }),
    })
    expect(res.status).toBe(201)
  })

  it('creates a minimal product (all optional fields absent)', async () => {
    const res = await SELF.fetch(`${BASE}/v1/products`, {
      method: 'POST',
      headers: ADMIN,
      body: JSON.stringify({ product: { name: 'Bare' }, variants: [{}] }),
    })
    expect(res.status).toBe(201)
  })
})

describe('bulk upsert (seeding)', () => {
  function bulk(items: unknown[]) {
    return SELF.fetch(`${BASE}/v1/products/bulk`, {
      method: 'POST',
      headers: ADMIN,
      body: JSON.stringify({ items }),
    })
  }

  it('inserts new items and dedupes a repeated brand within the batch', async () => {
    const res = await bulk([
      { barcode: '5000000000001', name: 'A', brand: 'AcmeFoods', pack_size: 100, unit: 'g', food_type: 'veg', group_key: 'g1' },
      { barcode: '5000000000002', name: 'B', brand: 'AcmeFoods' },
    ])
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, inserted: 2, refreshed: 0, skipped: 0, invalid: 0 })
  })

  it('refreshes an off variant on re-seed and upserts an existing brand', async () => {
    expect(await (await bulk([{ barcode: '5000000000003', name: 'C', brand: 'BrandX' }])).json()).toMatchObject({ inserted: 1 })
    expect(await (await bulk([{ barcode: '5000000000003', name: 'C', brand: 'BrandX', pack_size: 250 }])).json()).toMatchObject({ inserted: 0, refreshed: 1 })
    // new barcode, brand already in DB (cache empty in this fresh call) -> upsert existing
    expect(await (await bulk([{ barcode: '5000000000004', name: 'D', brand: 'BrandX' }])).json()).toMatchObject({ inserted: 1 })
  })

  it('skips a shop-improved (non-off) variant', async () => {
    const created = await SELF.fetch(`${BASE}/v1/products`, { method: 'POST', headers: ADMIN, body: productBody('5000000000005') })
    expect(created.status).toBe(201)
    expect(await (await bulk([{ barcode: '5000000000005', name: 'Override', brand: 'Y' }])).json()).toMatchObject({ inserted: 0, skipped: 1 })
  })

  it('counts invalid items and inserts the valid ones', async () => {
    const res = await bulk([{ name: 'NoBarcode' }, { barcode: '5000000000006' }, { barcode: '5000000000007', name: 'Valid', brand: 'Z' }])
    expect(await res.json()).toMatchObject({ inserted: 1, invalid: 2 })
  })

  it('inserts an item with no brand', async () => {
    expect(await (await bulk([{ barcode: '5000000000008', name: 'NoBrand', group_key: 'gnb' }])).json()).toMatchObject({ inserted: 1 })
  })

  it('rejects without an admin key → 401', async () => {
    const res = await SELF.fetch(`${BASE}/v1/products/bulk`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [] }),
    })
    expect(res.status).toBe(401)
  })

  it('rejects a wrong admin key → 401', async () => {
    const res = await SELF.fetch(`${BASE}/v1/products/bulk`, {
      method: 'POST',
      headers: { 'X-Admin-Key': 'wrong', 'content-type': 'application/json' },
      body: JSON.stringify({ items: [] }),
    })
    expect(res.status).toBe(401)
  })

  it('rejects invalid JSON → 400', async () => {
    const res = await SELF.fetch(`${BASE}/v1/products/bulk`, { method: 'POST', headers: ADMIN, body: 'nope' })
    expect(res.status).toBe(400)
  })

  it('rejects an empty items array → 422', async () => {
    expect((await bulk([])).status).toBe(422)
  })

  it('rejects a null body → 422', async () => {
    const res = await SELF.fetch(`${BASE}/v1/products/bulk`, { method: 'POST', headers: ADMIN, body: 'null' })
    expect(res.status).toBe(422)
  })
})

describe('search + browse', () => {
  function seed(items: unknown[]) {
    return SELF.fetch(`${BASE}/v1/products/bulk`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ items }) })
  }

  it('searches approved products by name', async () => {
    await seed([
      { barcode: '6000000000001', name: 'Parle G Biscuit', brand: 'Parle' },
      { barcode: '6000000000002', name: 'Marie Gold', brand: 'Britannia' },
    ])
    const res = await SELF.fetch(`${BASE}/v1/search?q=parle`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { query: string; results: { name: string; brand: string; barcode: string }[] }
    expect(body.query).toBe('parle')
    expect(body.results.some((r) => r.name === 'Parle G Biscuit' && r.brand === 'Parle' && r.barcode === '6000000000001')).toBe(true)
    expect(body.results.some((r) => r.name === 'Marie Gold')).toBe(false)
  })

  it('returns an empty result set for no matches', async () => {
    await seed([{ barcode: '6000000000003', name: 'Something', brand: 'X' }])
    const res = await SELF.fetch(`${BASE}/v1/search?q=zzzznotfound`)
    expect(((await res.json()) as { results: unknown[] }).results).toEqual([])
  })

  it('rejects a too-short query → 400', async () => {
    expect((await SELF.fetch(`${BASE}/v1/search?q=a`)).status).toBe(400)
  })

  it('rejects a missing query → 400', async () => {
    expect((await SELF.fetch(`${BASE}/v1/search`)).status).toBe(400)
  })

  it('honors the limit (default / clamp / cap)', async () => {
    await seed([
      { barcode: '6000000000010', name: 'Lim A', brand: 'L' },
      { barcode: '6000000000011', name: 'Lim B', brand: 'L' },
      { barcode: '6000000000012', name: 'Lim C', brand: 'L' },
    ])
    expect(((await (await SELF.fetch(`${BASE}/v1/search?q=lim&limit=1`)).json()) as { results: unknown[] }).results).toHaveLength(1)
    expect((await SELF.fetch(`${BASE}/v1/search?q=lim&limit=0`)).status).toBe(200) // <=0 -> default
    expect((await SELF.fetch(`${BASE}/v1/search?q=lim&limit=99999`)).status).toBe(200) // capped
  })

  it('lists brands with approved-product counts', async () => {
    await seed([
      { barcode: '6000000000020', name: 'P1', brand: 'BrandA' },
      { barcode: '6000000000021', name: 'P2', brand: 'BrandA' },
      { barcode: '6000000000022', name: 'P3', brand: 'BrandB' },
    ])
    const brands = ((await (await SELF.fetch(`${BASE}/v1/brands`)).json()) as { brands: { slug: string; product_count: number }[] }).brands
    expect(brands.find((b) => b.slug === 'branda')?.product_count).toBe(2)
  })

  it('lists products for a brand slug', async () => {
    await seed([{ barcode: '6000000000030', name: 'BrandProd', brand: 'MyBrand' }])
    const body = (await (await SELF.fetch(`${BASE}/v1/brand/mybrand`)).json()) as { slug: string; results: { name: string }[] }
    expect(body.slug).toBe('mybrand')
    expect(body.results.some((r) => r.name === 'BrandProd')).toBe(true)
  })

  it('returns an empty list for an unknown brand slug', async () => {
    expect(((await (await SELF.fetch(`${BASE}/v1/brand/nope-nope`)).json()) as { results: unknown[] }).results).toEqual([])
  })
})

describe('OFF fallback (network mocked)', () => {
  beforeAll(() => {
    fetchMock.activate()
    fetchMock.disableNetConnect()
  })
  afterEach(() => fetchMock.assertNoPendingInterceptors())

  it('unknown barcode with an OFF hit → 200 source off', async () => {
    fetchMock
      .get('https://world.openfoodfacts.org')
      .intercept({ path: (p: string) => p.startsWith('/api/v2/product/3017620422003.json') })
      .reply(
        200,
        JSON.stringify({
          status: 1,
          product: { product_name: 'Nutella', brands: 'Ferrero', image_url: '', quantity: '400g' },
        }),
      )
    const res = await SELF.fetch(`${BASE}/v1/product/3017620422003`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { found: boolean; source: string; off_suggestion: { name: string } }
    expect(body).toMatchObject({ found: true, source: 'off' })
    expect(body.off_suggestion.name).toBe('Nutella')
  })

  it('unknown barcode with an OFF miss → 404', async () => {
    fetchMock
      .get('https://world.openfoodfacts.org')
      .intercept({ path: (p: string) => p.startsWith('/api/v2/product/0000000000000.json') })
      .reply(200, JSON.stringify({ status: 0 }))
    const res = await SELF.fetch(`${BASE}/v1/product/0000000000000`)
    expect(res.status).toBe(404)
    expect(((await res.json()) as { found: boolean }).found).toBe(false)
  })
})
