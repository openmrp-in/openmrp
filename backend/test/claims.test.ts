import { fetchMock, SELF } from 'cloudflare:test'
import { beforeAll, afterEach, describe, it, expect } from 'vitest'

const BASE = 'https://openmrp.test'
const ADMIN = { 'X-Admin-Key': 'test-admin-key', 'content-type': 'application/json' }
const J = { 'content-type': 'application/json' }
const bearer = (t: string) => ({ Authorization: `Bearer ${t}`, 'content-type': 'application/json' })

beforeAll(() => {
  fetchMock.activate()
  fetchMock.disableNetConnect()
})
afterEach(() => fetchMock.assertNoPendingInterceptors())

const gepir = (gtin: string, status: number, body: unknown) =>
  fetchMock.get('https://gepir.test').intercept({ path: `/gtin/${gtin}`, method: 'GET' }).reply(status, body as Record<string, unknown>)

async function register(email: string): Promise<{ id: string; token: string }> {
  const r = await SELF.fetch(`${BASE}/v1/auth/register`, { method: 'POST', headers: J, body: JSON.stringify({ email, password: 'password1', name: email }) })
  const b = (await r.json()) as { token: string; developer: { id: string } }
  return { id: b.developer.id, token: b.token }
}

async function createBrandProduct(barcode: string): Promise<{ brandId: string; slug: string }> {
  const body = { brand: { name: `Brand ${barcode}` }, product: { name: 'Base' }, variants: [{ label: '1pc', barcode }] }
  const r = await SELF.fetch(`${BASE}/v1/products`, { method: 'POST', headers: ADMIN, body: JSON.stringify(body) })
  const b = (await r.json()) as { brand: { id: string; slug: string } }
  return { brandId: b.brand.id, slug: b.brand.slug }
}

const claim = (token: string, slug: string, gtin: string, company: string) =>
  SELF.fetch(`${BASE}/v1/brand-claims`, { method: 'POST', headers: bearer(token), body: JSON.stringify({ slug, gtin, company }) })

describe('brand-ownership claims (GEPIR)', () => {
  it('auto-verifies a claim when GEPIR confirms the company, granting brand ownership', async () => {
    const owner = await register('owner@x.com')
    const { brandId, slug } = await createBrandProduct('8901000000001')
    gepir('8901000000001', 200, { company_name: 'Acme Foods' })

    const res = await claim(owner.token, slug, '8901000000001', 'Acme Foods')
    expect(res.status).toBe(201)
    const body = (await res.json()) as { status: string; claim_id: string; gepir_company: string }
    expect(body).toMatchObject({ status: 'verified', gepir_company: 'Acme Foods' })

    const me = (await (await SELF.fetch(`${BASE}/v1/auth/me`, { headers: bearer(owner.token) })).json()) as { roles: string[]; owned_brands: { brand_id: string }[] }
    expect(me.roles).toContain('brand_owner')
    expect(me.owned_brands.map((b) => b.brand_id)).toContain(brandId)

    const mine = (await (await SELF.fetch(`${BASE}/v1/brand-claims/mine`, { headers: bearer(owner.token) })).json()) as { claims: { id: string; status: string }[] }
    expect(mine.claims.find((x) => x.id === body.claim_id)?.status).toBe('verified')
  })

  it('queues a claim for review when GEPIR disagrees', async () => {
    const acc = await register('acc@x.com')
    const { slug } = await createBrandProduct('8901000000002')
    gepir('8901000000002', 200, { company_name: 'Someone Else' })
    const body = (await (await claim(acc.token, slug, '8901000000002', 'Acme Foods')).json()) as { status: string }
    expect(body.status).toBe('pending')

    const me = (await (await SELF.fetch(`${BASE}/v1/auth/me`, { headers: bearer(acc.token) })).json()) as { roles: string[] }
    expect(me.roles).not.toContain('brand_owner') // not granted yet
  })

  it('queues a claim when GEPIR has no record (404)', async () => {
    const acc = await register('acc@x.com')
    const { slug } = await createBrandProduct('8901000000003')
    gepir('8901000000003', 404, {})
    expect(((await (await claim(acc.token, slug, '8901000000003', 'Acme')).json()) as { status: string }).status).toBe('pending')
  })

  it('404s an unknown brand and 401s without a token', async () => {
    const acc = await register('acc@x.com')
    expect((await claim(acc.token, 'no-such-brand', '8901000000004', 'Acme')).status).toBe(404)
    expect((await SELF.fetch(`${BASE}/v1/brand-claims`, { method: 'POST', headers: J, body: JSON.stringify({ slug: 'x', gtin: '12345678', company: 'y' }) })).status).toBe(401)
  })
})

describe('admin brand-claim review', () => {
  it('lists, approves (granting ownership) and rejects pending claims', async () => {
    const a1 = await register('a1@x.com')
    const a2 = await register('a2@x.com')
    const { brandId: b1, slug: s1 } = await createBrandProduct('8902000000001')
    const { slug: s2 } = await createBrandProduct('8902000000002')
    gepir('8902000000001', 404, {})
    gepir('8902000000002', 404, {})
    const c1 = (await (await claim(a1.token, s1, '8902000000001', 'Co1')).json()) as { claim_id: string }
    const c2 = (await (await claim(a2.token, s2, '8902000000002', 'Co2')).json()) as { claim_id: string }

    const queue = (await (await SELF.fetch(`${BASE}/v1/admin/brand-claims`, { headers: ADMIN })).json()) as { claims: { id: string }[] }
    expect(queue.claims.map((x) => x.id).sort()).toEqual([c1.claim_id, c2.claim_id].sort())

    // approve c1 → ownership granted to a1
    expect((await SELF.fetch(`${BASE}/v1/admin/brand-claims/${c1.claim_id}/approve`, { method: 'POST', headers: ADMIN })).status).toBe(200)
    const me1 = (await (await SELF.fetch(`${BASE}/v1/auth/me`, { headers: bearer(a1.token) })).json()) as { roles: string[]; owned_brands: { brand_id: string }[] }
    expect(me1.roles).toContain('brand_owner')
    expect(me1.owned_brands.map((b) => b.brand_id)).toContain(b1)
    expect((await SELF.fetch(`${BASE}/v1/admin/brand-claims/${c1.claim_id}/approve`, { method: 'POST', headers: ADMIN })).status).toBe(409) // already resolved

    // reject c2
    expect((await SELF.fetch(`${BASE}/v1/admin/brand-claims/${c2.claim_id}/reject`, { method: 'POST', headers: ADMIN })).status).toBe(200)
    expect((await SELF.fetch(`${BASE}/v1/admin/brand-claims/${c2.claim_id}/reject`, { method: 'POST', headers: ADMIN })).status).toBe(409)
  })

  it('404s approve/reject on an unknown claim and 401s without the admin key', async () => {
    expect((await SELF.fetch(`${BASE}/v1/admin/brand-claims/ghost/approve`, { method: 'POST', headers: ADMIN })).status).toBe(404)
    expect((await SELF.fetch(`${BASE}/v1/admin/brand-claims/ghost/reject`, { method: 'POST', headers: ADMIN })).status).toBe(404)
    expect((await SELF.fetch(`${BASE}/v1/admin/brand-claims`)).status).toBe(401)
  })
})
