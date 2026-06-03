import { SELF, env } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'
import { snapshotVersion } from '../src/db/versions'

const BASE = 'https://openmrp.test'
const ADMIN = { 'X-Admin-Key': 'test-admin-key', 'content-type': 'application/json' }
const KEY_H = { 'X-Api-Key': 'omrp_live_devkeyprefix.dev0000000000000000000000000000000000000000000000' }

const createBody = (barcode: string) =>
  JSON.stringify({
    brand: { name: 'VerBrand' },
    product: { name: 'Original Name', food_type: 'veg', description: 'orig desc' },
    variants: [{ label: '100g', barcode, mrp_paise: 1000 }],
    translations: [{ lang: 'ta', name: 'அசல்' }],
  })
const editBody = (name: string) =>
  JSON.stringify({ name, description: 'new desc', translations: [{ lang: 'hi', name: 'नया' }] })

describe('product versioning', () => {
  it('versions on create + edit, then reverts to a previous version', async () => {
    const barcode = '9001000000001'
    expect((await SELF.fetch(`${BASE}/v1/products`, { method: 'POST', headers: ADMIN, body: createBody(barcode) })).status).toBe(201)

    const edited = await SELF.fetch(`${BASE}/v1/admin/products/${barcode}/edit`, { method: 'POST', headers: ADMIN, body: editBody('Edited Name') })
    expect(edited.status).toBe(200)
    expect(((await edited.json()) as { product: { name: string } }).product.name).toBe('Edited Name')

    const vlist = (await (await SELF.fetch(`${BASE}/v1/admin/products/${barcode}/versions`, { headers: ADMIN })).json()) as {
      versions: { version: number; note: string }[]
    }
    expect(vlist.versions.map((v) => v.version)).toEqual([2, 1])

    const rev = await SELF.fetch(`${BASE}/v1/admin/products/${barcode}/revert`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ version: 1 }) })
    expect(rev.status).toBe(200)
    expect(await rev.json()).toMatchObject({ reverted: true, version: 1 })

    const got = (await (await SELF.fetch(`${BASE}/v1/product/${barcode}`, { headers: KEY_H })).json()) as {
      product: { name: string }
      translations: { lang: string }[]
    }
    expect(got.product.name).toBe('Original Name')
    expect(got.translations.map((t) => t.lang)).toEqual(['ta'])
  })

  it('edits a versionless (seeded) product, snapshotting a baseline first', async () => {
    const barcode = '9002000000002'
    await SELF.fetch(`${BASE}/v1/products/bulk`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ items: [{ barcode, name: 'Seeded', brand: 'SeedBrand' }] }) })
    expect((await SELF.fetch(`${BASE}/v1/admin/products/${barcode}/edit`, { method: 'POST', headers: ADMIN, body: editBody('Seed Edited') })).status).toBe(200)
    const vlist = (await (await SELF.fetch(`${BASE}/v1/admin/products/${barcode}/versions`, { headers: ADMIN })).json()) as {
      versions: { version: number; note: string }[]
    }
    expect(vlist.versions.length).toBe(2)
    expect(vlist.versions.find((v) => v.note === 'baseline')?.version).toBe(1)
  })

  it('edit / versions / revert on an unknown barcode → 404', async () => {
    expect((await SELF.fetch(`${BASE}/v1/admin/products/0000/edit`, { method: 'POST', headers: ADMIN, body: editBody('x') })).status).toBe(404)
    expect((await SELF.fetch(`${BASE}/v1/admin/products/0000/versions`, { headers: ADMIN })).status).toBe(404)
    expect((await SELF.fetch(`${BASE}/v1/admin/products/0000/revert`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ version: 1 }) })).status).toBe(404)
  })

  it('revert to an unknown version → 404', async () => {
    const barcode = '9003000000003'
    await SELF.fetch(`${BASE}/v1/products`, { method: 'POST', headers: ADMIN, body: createBody(barcode) })
    expect((await SELF.fetch(`${BASE}/v1/admin/products/${barcode}/revert`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ version: 99 }) })).status).toBe(404)
  })

  it('admin product routes require the admin key → 401', async () => {
    expect((await SELF.fetch(`${BASE}/v1/admin/products/x/versions`)).status).toBe(401)
  })

  it('snapshotVersion returns 0 for an unknown product', async () => {
    expect(await snapshotVersion(env.DB, 'no-such-product', 'note', 'admin', '2026-01-01T00:00:00.000Z')).toBe(0)
  })
})
