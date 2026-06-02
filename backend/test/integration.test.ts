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
