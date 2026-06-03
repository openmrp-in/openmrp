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

async function grantRole(accountId: string, role: string): Promise<Response> {
  return SELF.fetch(`${BASE}/v1/admin/accounts/${accountId}/roles`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ role }) })
}

async function createProduct(barcode: string, withBrand = true): Promise<{ productId: string; brandId: string | null }> {
  const body = {
    ...(withBrand ? { brand: { name: `Brand-${barcode}` } } : {}),
    product: { name: 'Base', food_type: 'none' },
    variants: [{ label: '1pc', barcode }],
  }
  const r = await SELF.fetch(`${BASE}/v1/products`, { method: 'POST', headers: ADMIN, body: JSON.stringify(body) })
  const b = (await r.json()) as { product: { id: string }; brand: { id: string } | null }
  return { productId: b.product.id, brandId: b.brand?.id ?? null }
}

const submit = (token: string, barcode: string, name: string) =>
  SELF.fetch(`${BASE}/v1/contributions`, { method: 'POST', headers: bearer(token), body: JSON.stringify({ barcode, edit: { name }, note: `set ${name}` }) })
const approve = (token: string, id: string) =>
  SELF.fetch(`${BASE}/v1/contributions/${id}/approve`, { method: 'POST', headers: bearer(token) })
const reject = (token: string, id: string) =>
  SELF.fetch(`${BASE}/v1/contributions/${id}/reject`, { method: 'POST', headers: bearer(token) })
const getName = async (barcode: string) =>
  ((await (await SELF.fetch(`${BASE}/v1/product/${barcode}`, { headers: KEY_H })).json()) as { product: { name: string } }).product.name

describe('community contributions — 2-approval engine', () => {
  it('queues a contributor edit, then applies it on the 2nd distinct approval', async () => {
    const alice = await register('alice@x.com')
    const bob = await register('bob@x.com')
    const carol = await register('carol@x.com')
    for (const a of [alice, bob, carol]) expect((await grantRole(a.id, 'contributor')).status).toBe(200)
    const barcode = '8100000000001'
    await createProduct(barcode)

    const sub = await submit(alice.token, barcode, 'Crowd Name')
    expect(sub.status).toBe(201)
    const { contribution_id, status } = (await sub.json()) as { contribution_id: string; status: string }
    expect(status).toBe('pending')

    expect((await approve(alice.token, contribution_id)).status).toBe(403) // own
    const a1 = await approve(bob.token, contribution_id)
    expect(a1.status).toBe(200)
    expect((await a1.json()) as { status: string; approvals: number }).toMatchObject({ status: 'pending', approvals: 1 })

    // a duplicate approval from the same account does not advance the count
    expect((await (await approve(bob.token, contribution_id)).json()) as { approvals: number }).toMatchObject({ approvals: 1 })

    const a2 = await approve(carol.token, contribution_id)
    expect(a2.status).toBe(200)
    const applied = (await a2.json()) as { status: string; approvals: number; version: number }
    expect(applied.status).toBe('applied')
    expect(applied.approvals).toBe(2)
    expect(applied.version).toBeGreaterThan(0)

    expect(await getName(barcode)).toBe('Crowd Name')
    expect((await approve(carol.token, contribution_id)).status).toBe(409) // already resolved

    const detail = (await (await SELF.fetch(`${BASE}/v1/contributions/${contribution_id}`, { headers: bearer(alice.token) })).json()) as { status: string; approvals: number }
    expect(detail).toMatchObject({ status: 'applied', approvals: 2 })
    const mine = (await (await SELF.fetch(`${BASE}/v1/contributions/mine`, { headers: bearer(alice.token) })).json()) as { contributions: { id: string }[] }
    expect(mine.contributions.map((c) => c.id)).toContain(contribution_id)
  })

  it('applies a community edit on a brand-less, version-less (seeded) product, backfilling a baseline', async () => {
    const alice = await register('alice@x.com')
    const bob = await register('bob@x.com')
    for (const a of [alice, bob]) await grantRole(a.id, 'contributor')
    const barcode = '8100000000002'
    // bulk seed (no version, no brand)
    await SELF.fetch(`${BASE}/v1/products/bulk`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ items: [{ barcode, name: 'Seeded' }] }) })

    const { contribution_id } = (await (await submit(alice.token, barcode, 'Fixed Name')).json()) as { contribution_id: string }
    await approve(bob.token, contribution_id)
    const carol = await register('carol@x.com')
    await grantRole(carol.id, 'contributor')
    const applied = (await (await approve(carol.token, contribution_id)).json()) as { status: string }
    expect(applied.status).toBe('applied')
    expect(await getName(barcode)).toBe('Fixed Name')

    // versions: baseline + community edit
    const verbarcode = barcode
    const versions = (await (await SELF.fetch(`${BASE}/v1/admin/products/${verbarcode}/versions`, { headers: ADMIN })).json()) as { versions: { note: string }[] }
    expect(versions.versions.some((v) => v.note === 'baseline')).toBe(true)
    expect(versions.versions.some((v) => v.note === 'community edit')).toBe(true)
  })

  it('auto-applies (and versions) a verified brand owner edit without approvals', async () => {
    const owner = await register('owner@x.com')
    const barcode = '8100000000003'
    const { brandId } = await createProduct(barcode)
    const grant = await SELF.fetch(`${BASE}/v1/admin/brand-owners`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ account_id: owner.id, brand_id: brandId }) })
    expect(grant.status).toBe(200)

    const sub = await submit(owner.token, barcode, 'Official Name')
    expect(sub.status).toBe(201)
    const body = (await sub.json()) as { status: string; version: number }
    expect(body.status).toBe('applied')
    expect(body.version).toBeGreaterThan(0)
    expect(await getName(barcode)).toBe('Official Name')

    const me = (await (await SELF.fetch(`${BASE}/v1/auth/me`, { headers: bearer(owner.token) })).json()) as {
      roles: string[]
      owned_brands: { brand_id: string }[]
    }
    expect(me.roles).toContain('brand_owner')
    expect(me.owned_brands.map((b) => b.brand_id)).toContain(brandId)
  })

  it('serves current product state to a logged-in account for prefilling', async () => {
    const alice = await register('alice@x.com')
    const barcode = '8100000000006'
    await createProduct(barcode)
    const res = await SELF.fetch(`${BASE}/v1/contributions/product/${barcode}`, { headers: bearer(alice.token) })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { product: { name: string } }).product.name).toBe('Base')
    expect((await SELF.fetch(`${BASE}/v1/contributions/product/0000`, { headers: bearer(alice.token) })).status).toBe(404)
    expect((await SELF.fetch(`${BASE}/v1/contributions/product/${barcode}`)).status).toBe(401)
  })

  it('forbids submitting without the contributor role or brand ownership', async () => {
    const dave = await register('dave@x.com')
    const barcode = '8100000000004'
    await createProduct(barcode)
    expect((await submit(dave.token, barcode, 'Nope')).status).toBe(403)
  })

  it('rejects submit on unknown barcode (404) and unauthenticated (401)', async () => {
    const alice = await register('alice@x.com')
    await grantRole(alice.id, 'contributor')
    expect((await submit(alice.token, '0000', 'X')).status).toBe(404)
    expect((await SELF.fetch(`${BASE}/v1/contributions`, { method: 'POST', headers: J, body: JSON.stringify({ barcode: 'x', edit: { name: 'y' } }) })).status).toBe(401)
  })

  it('lets the author withdraw and an admin-role account reject; guards the rest', async () => {
    const author = await register('author@x.com')
    const adminUser = await register('adminuser@x.com')
    const other = await register('other@x.com')
    await grantRole(author.id, 'contributor')
    await grantRole(adminUser.id, 'admin')
    await grantRole(other.id, 'contributor')
    const barcode = '8100000000005'
    await createProduct(barcode)

    // author withdraws own
    const c1 = (await (await submit(author.token, barcode, 'A')).json()) as { contribution_id: string }
    expect((await reject(author.token, c1.contribution_id)).status).toBe(200)
    expect((await reject(author.token, c1.contribution_id)).status).toBe(409) // already resolved

    // admin-role account rejects someone else's
    const c2 = (await (await submit(author.token, barcode, 'B')).json()) as { contribution_id: string }
    expect((await reject(adminUser.token, c2.contribution_id)).status).toBe(200)

    // a non-author, non-admin cannot reject
    const c3 = (await (await submit(author.token, barcode, 'C')).json()) as { contribution_id: string }
    expect((await reject(other.token, c3.contribution_id)).status).toBe(403)

    // unknown id → 404
    expect((await reject(adminUser.token, 'no-such')).status).toBe(404)
  })

  it('gates the review queue + approve behind the reviewer role and handles missing ids', async () => {
    const dave = await register('dave@x.com') // no role
    const alice = await register('alice@x.com')
    await grantRole(alice.id, 'contributor')
    const barcode = '8100000000007'
    await createProduct(barcode)
    const { contribution_id } = (await (await submit(alice.token, barcode, 'Queued')).json()) as { contribution_id: string }

    expect((await SELF.fetch(`${BASE}/v1/contributions`, { headers: bearer(dave.token) })).status).toBe(403)
    const queue = await SELF.fetch(`${BASE}/v1/contributions`, { headers: bearer(alice.token) })
    expect(queue.status).toBe(200)
    const list = (await queue.json()) as { contributions: { id: string }[] }
    expect(list.contributions.map((c) => c.id)).toContain(contribution_id)

    expect((await approve(dave.token, 'anything')).status).toBe(403) // not a reviewer
    expect((await approve(alice.token, 'no-such')).status).toBe(404) // reviewer, missing
    expect((await SELF.fetch(`${BASE}/v1/contributions/no-such`, { headers: bearer(alice.token) })).status).toBe(404)
  })
})

describe('admin role + brand-owner management', () => {
  it('lists, grants and revokes roles', async () => {
    const acc = await register('roleacc@x.com')
    expect((await (await SELF.fetch(`${BASE}/v1/admin/accounts/${acc.id}/roles`, { headers: ADMIN })).json()) as { roles: string[] }).toEqual({ roles: [] })

    const granted = (await (await grantRole(acc.id, 'contributor')).json()) as { roles: string[] }
    expect(granted.roles).toEqual(['contributor'])

    const revoked = await SELF.fetch(`${BASE}/v1/admin/accounts/${acc.id}/roles/revoke`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ role: 'contributor' }) })
    expect((await revoked.json()) as { roles: string[] }).toEqual({ roles: [] })
  })

  it('404s role ops on an unknown account and 422s an invalid role', async () => {
    expect((await SELF.fetch(`${BASE}/v1/admin/accounts/ghost/roles`, { headers: ADMIN })).status).toBe(404)
    expect((await grantRole('ghost', 'contributor')).status).toBe(404)
    expect((await SELF.fetch(`${BASE}/v1/admin/accounts/ghost/roles/revoke`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ role: 'contributor' }) })).status).toBe(404)
    expect((await grantRole((await register('valid@x.com')).id, 'wizard')).status).toBe(422)
  })

  it('grants brand ownership and 404s unknown account or brand', async () => {
    const acc = await register('bo@x.com')
    const barcode = '8100000000009'
    const { brandId } = await createProduct(barcode)
    expect((await SELF.fetch(`${BASE}/v1/admin/brand-owners`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ account_id: acc.id, brand_id: brandId }) })).status).toBe(200)
    expect((await SELF.fetch(`${BASE}/v1/admin/brand-owners`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ account_id: 'ghost', brand_id: brandId }) })).status).toBe(404)
    expect((await SELF.fetch(`${BASE}/v1/admin/brand-owners`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ account_id: acc.id, brand_id: 'no-brand' }) })).status).toBe(404)
  })

  it('requires the admin key for the new admin routes', async () => {
    expect((await SELF.fetch(`${BASE}/v1/admin/accounts/x/roles`)).status).toBe(401)
  })
})
