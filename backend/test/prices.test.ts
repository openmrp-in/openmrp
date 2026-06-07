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
const grantRole = (id: string, role: string) => SELF.fetch(`${BASE}/v1/admin/accounts/${id}/roles`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ role }) })
async function createProduct(barcode: string): Promise<{ brandId: string }> {
  const r = await SELF.fetch(`${BASE}/v1/products`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ brand: { name: `B-${barcode}` }, product: { name: 'P' }, variants: [{ label: '1pc', barcode }] }) })
  return { brandId: ((await r.json()) as { brand: { id: string } }).brand.id }
}
const submit = (token: string, barcode: string, mrp_paise: number, source = 'pack') =>
  SELF.fetch(`${BASE}/v1/prices`, { method: 'POST', headers: bearer(token), body: JSON.stringify({ barcode, mrp_paise, source, note: 'from the pack' }) })
const approve = (token: string, id: string) => SELF.fetch(`${BASE}/v1/prices/${id}/approve`, { method: 'POST', headers: bearer(token) })
const reject = (token: string, id: string) => SELF.fetch(`${BASE}/v1/prices/${id}/reject`, { method: 'POST', headers: bearer(token) })
const variantMrp = async (barcode: string) =>
  ((await (await SELF.fetch(`${BASE}/v1/product/${barcode}`, { headers: KEY_H })).json()) as { variants: { mrp_paise: number; mrp_source: string }[] }).variants[0]

describe('MRP price reports — 2-approval engine', () => {
  it('queues a report, then sets the MRP on the 2nd distinct approval', async () => {
    const alice = await register('alice@x.com'), bob = await register('bob@x.com'), carol = await register('carol@x.com')
    for (const a of [alice, bob, carol]) await grantRole(a.id, 'contributor')
    const barcode = '7700000000001'
    await createProduct(barcode)

    const sub = await submit(alice.token, barcode, 4500)
    expect(sub.status).toBe(201)
    const { report_id } = (await sub.json()) as { report_id: string; status: string }

    expect((await approve(alice.token, report_id)).status).toBe(403) // own
    expect((await (await approve(bob.token, report_id)).json()) as { approvals: number }).toMatchObject({ status: 'pending', approvals: 1 })
    expect((await (await approve(bob.token, report_id)).json()) as { approvals: number }).toMatchObject({ approvals: 1 }) // dup
    const a2 = (await (await approve(carol.token, report_id)).json()) as { status: string; mrp_paise: number }
    expect(a2).toMatchObject({ status: 'applied', mrp_paise: 4500 })

    const v = await variantMrp(barcode)
    expect(v).toMatchObject({ mrp_paise: 4500, mrp_source: 'pack' })
    expect((await approve(carol.token, report_id)).status).toBe(409) // already resolved

    expect(((await (await SELF.fetch(`${BASE}/v1/prices/${report_id}`, { headers: bearer(alice.token) })).json()) as { status: string }).status).toBe('applied')
    const mine = (await (await SELF.fetch(`${BASE}/v1/prices/mine`, { headers: bearer(alice.token) })).json()) as { reports: { id: string }[] }
    expect(mine.reports.map((r) => r.id)).toContain(report_id)
  })

  it('auto-applies a verified brand owner report instantly', async () => {
    const owner = await register('owner@x.com')
    const barcode = '7700000000002'
    const { brandId } = await createProduct(barcode)
    await SELF.fetch(`${BASE}/v1/admin/brand-owners`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ account_id: owner.id, brand_id: brandId }) })

    const body = (await (await submit(owner.token, barcode, 9900, 'brand')).json()) as { status: string; mrp_paise: number }
    expect(body).toMatchObject({ status: 'applied', mrp_paise: 9900 })
    expect(await variantMrp(barcode)).toMatchObject({ mrp_paise: 9900, mrp_source: 'brand' })
  })

  it('forbids reporting without the contributor role or brand ownership', async () => {
    const dave = await register('dave@x.com')
    const barcode = '7700000000003'
    await createProduct(barcode)
    expect((await submit(dave.token, barcode, 1000)).status).toBe(403)
  })

  it('404s an unknown barcode, 401s unauthenticated, 422s a non-positive MRP', async () => {
    const alice = await register('alice@x.com'); await grantRole(alice.id, 'contributor')
    const barcode = '7700000000004'; await createProduct(barcode)
    expect((await submit(alice.token, '0000', 1000)).status).toBe(404)
    expect((await SELF.fetch(`${BASE}/v1/prices`, { method: 'POST', headers: J, body: JSON.stringify({ barcode, mrp_paise: 1000 }) })).status).toBe(401)
    expect((await submit(alice.token, barcode, 0)).status).toBe(422)
  })

  it('lets the author withdraw and an admin reject; guards the rest', async () => {
    const author = await register('author@x.com'), adminU = await register('adminu@x.com'), other = await register('other@x.com')
    await grantRole(author.id, 'contributor'); await grantRole(adminU.id, 'admin'); await grantRole(other.id, 'contributor')
    const barcode = '7700000000005'; await createProduct(barcode)

    const c1 = (await (await submit(author.token, barcode, 1200)).json()) as { report_id: string }
    expect((await reject(author.token, c1.report_id)).status).toBe(200)
    expect((await reject(author.token, c1.report_id)).status).toBe(409)
    const c2 = (await (await submit(author.token, barcode, 1300)).json()) as { report_id: string }
    expect((await reject(adminU.token, c2.report_id)).status).toBe(200)
    const c3 = (await (await submit(author.token, barcode, 1400)).json()) as { report_id: string }
    expect((await reject(other.token, c3.report_id)).status).toBe(403)
    expect((await reject(adminU.token, 'no-such')).status).toBe(404)
  })

  it('gates the queue + approve behind the reviewer role and handles missing ids', async () => {
    const dave = await register('dave@x.com')
    const alice = await register('alice@x.com'); await grantRole(alice.id, 'contributor')
    const barcode = '7700000000006'; await createProduct(barcode)
    const { report_id } = (await (await submit(alice.token, barcode, 2500)).json()) as { report_id: string }

    expect((await SELF.fetch(`${BASE}/v1/prices`, { headers: bearer(dave.token) })).status).toBe(403)
    const queue = (await (await SELF.fetch(`${BASE}/v1/prices`, { headers: bearer(alice.token) })).json()) as { reports: { id: string }[] }
    expect(queue.reports.map((r) => r.id)).toContain(report_id)

    expect((await approve(dave.token, 'anything')).status).toBe(403)
    expect((await approve(alice.token, 'no-such')).status).toBe(404)
    expect((await SELF.fetch(`${BASE}/v1/prices/no-such`, { headers: bearer(alice.token) })).status).toBe(404)
  })
})

describe('admin authoritative price set (operator / gov load)', () => {
  it('sets MRPs directly, reporting unknown barcodes', async () => {
    const barcode = '7700000000010'
    await createProduct(barcode)
    const res = await SELF.fetch(`${BASE}/v1/admin/prices`, {
      method: 'POST',
      headers: ADMIN,
      body: JSON.stringify({ items: [{ barcode, mrp_paise: 3299, source: 'gov' }, { barcode: 'unknown-bc', mrp_paise: 100 }] }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ set: 1, missing: ['unknown-bc'] })
    expect(await variantMrp(barcode)).toMatchObject({ mrp_paise: 3299, mrp_source: 'gov' })
  })

  it('requires the admin key and a valid payload', async () => {
    expect((await SELF.fetch(`${BASE}/v1/admin/prices`, { method: 'POST', headers: J, body: JSON.stringify({ items: [{ barcode: 'x', mrp_paise: 1 }] }) })).status).toBe(401)
    expect((await SELF.fetch(`${BASE}/v1/admin/prices`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ items: [] }) })).status).toBe(422)
    expect((await SELF.fetch(`${BASE}/v1/admin/prices`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ items: [{ barcode: 'x', mrp_paise: 0 }] }) })).status).toBe(422)
  })
})
