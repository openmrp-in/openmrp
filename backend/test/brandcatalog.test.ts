import { SELF } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'

const BASE = 'https://openmrp.test'
const ADMIN = { 'X-Admin-Key': 'test-admin-key', 'content-type': 'application/json' }
const J = { 'content-type': 'application/json' }
const KEY_H = { 'X-Api-Key': 'omrp_live_devkeyprefix.dev0000000000000000000000000000000000000000000000' }
const bearer = (t: string) => ({ Authorization: `Bearer ${t}`, 'content-type': 'application/json' })

async function register(email: string): Promise<{ id: string; token: string }> {
  const r = await SELF.fetch(`${BASE}/v1/auth/register`, { method: 'POST', headers: J, body: JSON.stringify({ email, password: 'password1', name: email }) })
  const b = (await r.json()) as { token: string; developer: { id: string } }
  return { id: b.developer.id, token: b.token }
}
async function createBrand(name: string, seedBarcode: string): Promise<{ brandId: string; slug: string }> {
  const r = await SELF.fetch(`${BASE}/v1/products`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ brand: { name }, product: { name: `${name} seed` }, variants: [{ label: '1pc', barcode: seedBarcode }] }) })
  const b = (await r.json()) as { brand: { id: string; slug: string } }
  return { brandId: b.brand.id, slug: b.brand.slug }
}
const grantOwner = (accountId: string, brandId: string) =>
  SELF.fetch(`${BASE}/v1/admin/brand-owners`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ account_id: accountId, brand_id: brandId }) })
const upload = (token: string, slug: string, items: unknown[]) =>
  SELF.fetch(`${BASE}/v1/brand-catalog`, { method: 'POST', headers: bearer(token), body: JSON.stringify({ slug, items }) })
const variant = async (barcode: string) =>
  ((await (await SELF.fetch(`${BASE}/v1/product/${barcode}`, { headers: KEY_H })).json()) as { product: { name: string; category: string }; variants: { mrp_paise: number; mrp_source: string }[] })

describe('brand catalog upload', () => {
  it('lets a verified owner upsert products + MRP authoritatively', async () => {
    const owner = await register('owner@x.com')
    const { brandId, slug } = await createBrand('SnackCo', '7900000000001')
    await grantOwner(owner.id, brandId)

    const res = await upload(owner.token, slug, [
      { barcode: '7900000000010', name: 'SnackCo Chips', mrp_paise: 2000, category: 'Snacks', food_type: 'veg' },
      { barcode: '7900000000011', name: 'SnackCo Namkeen', mrp_paise: 3000 },
      { barcode: '7900000000012', name: 'SnackCo NoPrice' }, // no MRP
      { barcode: '', name: 'bad row' }, // error
    ])
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ created: 3, updated: 0, priced: 2, errors: [{ barcode: '', error: 'barcode and name are required' }] })

    const v = await variant('7900000000010')
    expect(v.product).toMatchObject({ name: 'SnackCo Chips', category: 'Snacks' })
    expect(v.variants[0]).toMatchObject({ mrp_paise: 2000, mrp_source: 'brand' })

    // searchable (approved)
    const search = (await (await SELF.fetch(`${BASE}/v1/search?q=SnackCo+Chips`, { headers: KEY_H })).json()) as { results: { barcode: string }[] }
    expect(search.results.map((r) => r.barcode)).toContain('7900000000010')

    // re-upload the same barcode → updated, not created
    const res2 = await upload(owner.token, slug, [{ barcode: '7900000000010', name: 'SnackCo Chips Classic', mrp_paise: 2200 }])
    expect(await res2.json()).toMatchObject({ created: 0, updated: 1, priced: 1 })
    const v2 = await variant('7900000000010')
    expect(v2.product.name).toBe('SnackCo Chips Classic')
    expect(v2.variants[0].mrp_paise).toBe(2200)
  })

  it('refuses a non-owner (403) and an unknown brand (404)', async () => {
    const owner = await register('owner@x.com')
    const stranger = await register('stranger@x.com')
    const { brandId, slug } = await createBrand('OwnedCo', '7900000000002')
    await grantOwner(owner.id, brandId)

    expect((await upload(stranger.token, slug, [{ barcode: '7900000000020', name: 'x', mrp_paise: 100 }])).status).toBe(403)
    expect((await upload(owner.token, 'no-such-brand', [{ barcode: '7900000000021', name: 'x', mrp_paise: 100 }])).status).toBe(404)
  })

  it('requires auth and a non-empty item list', async () => {
    const owner = await register('owner@x.com')
    const { slug } = await createBrand('AuthCo', '7900000000003')
    expect((await SELF.fetch(`${BASE}/v1/brand-catalog`, { method: 'POST', headers: J, body: JSON.stringify({ slug, items: [{ barcode: 'x', name: 'y' }] }) })).status).toBe(401)
    expect((await upload(owner.token, slug, [])).status).toBe(422)
  })
})
