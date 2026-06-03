import { SELF } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'

const BASE = 'https://openmrp.test'
const JSON_H = { 'content-type': 'application/json' }
const ADMIN = { 'X-Admin-Key': 'test-admin-key', ...JSON_H }

function register(email: string, password = 'password123') {
  return SELF.fetch(`${BASE}/v1/auth/register`, {
    method: 'POST',
    headers: JSON_H,
    body: JSON.stringify({ email, password, name: 'Dev' }),
  })
}
async function tokenFor(email: string): Promise<string> {
  return ((await (await register(email)).json()) as { token: string }).token
}

describe('auth', () => {
  it('registers and returns a token', async () => {
    const res = await register('a@x.com')
    expect(res.status).toBe(201)
    const body = (await res.json()) as { token: string; developer: { email: string } }
    expect(body.token).toBeTruthy()
    expect(body.developer.email).toBe('a@x.com')
  })

  it('rejects a duplicate email → 409', async () => {
    await register('dup@x.com')
    expect((await register('dup@x.com')).status).toBe(409)
  })

  it('rejects a short password → 422', async () => {
    expect((await register('b@x.com', 'short')).status).toBe(422)
  })

  it('logs in with correct credentials', async () => {
    await register('login@x.com')
    const res = await SELF.fetch(`${BASE}/v1/auth/login`, {
      method: 'POST',
      headers: JSON_H,
      body: JSON.stringify({ email: 'login@x.com', password: 'password123' }),
    })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { token: string }).token).toBeTruthy()
  })

  it('rejects a wrong password → 401', async () => {
    await register('badlogin@x.com')
    const res = await SELF.fetch(`${BASE}/v1/auth/login`, {
      method: 'POST',
      headers: JSON_H,
      body: JSON.stringify({ email: 'badlogin@x.com', password: 'wrongpass1' }),
    })
    expect(res.status).toBe(401)
  })

  it('rejects login for an unknown email → 401', async () => {
    const res = await SELF.fetch(`${BASE}/v1/auth/login`, {
      method: 'POST',
      headers: JSON_H,
      body: JSON.stringify({ email: 'nobody@x.com', password: 'whatever1' }),
    })
    expect(res.status).toBe(401)
  })

  it('GET /me returns the developer', async () => {
    const t = await tokenFor('me@x.com')
    const res = await SELF.fetch(`${BASE}/v1/auth/me`, { headers: { Authorization: `Bearer ${t}` } })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { email: string }).email).toBe('me@x.com')
  })

  it('GET /me without a token → 401', async () => {
    expect((await SELF.fetch(`${BASE}/v1/auth/me`)).status).toBe(401)
  })

  it('GET /me with a non-bearer header → 401', async () => {
    expect((await SELF.fetch(`${BASE}/v1/auth/me`, { headers: { Authorization: 'Basic xxx' } })).status).toBe(401)
  })

  it('GET /me with a garbage token → 401', async () => {
    expect((await SELF.fetch(`${BASE}/v1/auth/me`, { headers: { Authorization: 'Bearer garbage.token' } })).status).toBe(401)
  })
})

describe('api keys', () => {
  it('creates, lists and revokes a key', async () => {
    const t = await tokenFor('keys@x.com')
    const auth = { Authorization: `Bearer ${t}`, ...JSON_H }

    const created = await SELF.fetch(`${BASE}/v1/keys`, { method: 'POST', headers: auth, body: JSON.stringify({ name: 'CI' }) })
    expect(created.status).toBe(201)
    const key = (await created.json()) as { id: string; key: string }
    expect(key.key.startsWith('omrp_live_')).toBe(true)

    const list = await SELF.fetch(`${BASE}/v1/keys`, { headers: auth })
    const keys = ((await list.json()) as { keys: { id: string; revoked: boolean }[] }).keys
    expect(keys.find((k) => k.id === key.id)?.revoked).toBe(false)

    const revoke = await SELF.fetch(`${BASE}/v1/keys/${key.id}/revoke`, { method: 'POST', headers: auth })
    expect(revoke.status).toBe(200)
    expect(((await revoke.json()) as { revoked: boolean }).revoked).toBe(true)
  })

  it('revoking an unknown key → 404', async () => {
    const t = await tokenFor('keys2@x.com')
    const res = await SELF.fetch(`${BASE}/v1/keys/nope/revoke`, { method: 'POST', headers: { Authorization: `Bearer ${t}` } })
    expect(res.status).toBe(404)
  })

  it('keys endpoints require auth → 401', async () => {
    expect((await SELF.fetch(`${BASE}/v1/keys`)).status).toBe(401)
  })
})

describe('super-admin', () => {
  it('lists developers and keys', async () => {
    const t = await tokenFor('admindev@x.com')
    await SELF.fetch(`${BASE}/v1/keys`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, ...JSON_H },
      body: JSON.stringify({ name: 'k' }),
    })
    const devs = await SELF.fetch(`${BASE}/v1/admin/developers`, { headers: ADMIN })
    expect(devs.status).toBe(200)
    expect(((await devs.json()) as { developers: unknown[] }).developers.length).toBeGreaterThan(0)

    const keys = await SELF.fetch(`${BASE}/v1/admin/keys?limit=10`, { headers: ADMIN })
    expect(keys.status).toBe(200)
    expect(((await keys.json()) as { keys: unknown[] }).keys.length).toBeGreaterThan(0)
  })

  it('admin endpoints require the admin key → 401', async () => {
    expect((await SELF.fetch(`${BASE}/v1/admin/developers`)).status).toBe(401)
  })
})
