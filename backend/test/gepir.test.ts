import { fetchMock } from 'cloudflare:test'
import { beforeAll, afterEach, describe, it, expect } from 'vitest'
import { autoVerifyClaim, companyMatches, gepirLookup, normalizeCompany } from '../src/lib/gepir'
import type { Env } from '../src/env'

const envWith = (base: string) => ({ GEPIR_BASE_URL: base }) as unknown as Env
const stub = (gtin: string, status: number, body: unknown) =>
  fetchMock.get('https://g.test').intercept({ path: `/gtin/${gtin}`, method: 'GET' }).reply(status, body as Record<string, unknown>)

beforeAll(() => {
  fetchMock.activate()
  fetchMock.disableNetConnect()
})
afterEach(() => fetchMock.assertNoPendingInterceptors())

describe('company matching', () => {
  it('normalizes suffixes + punctuation', () => {
    expect(normalizeCompany('Acme Foods Pvt. Ltd.')).toBe('acme foods')
    expect(normalizeCompany('Pvt Ltd')).toBe('')
  })

  it('matches on equality / substring, rejects mismatches + empties', () => {
    expect(companyMatches('Acme Foods Pvt Ltd', 'Acme Foods')).toBe(true)
    expect(companyMatches('Acme Foods', 'Acme')).toBe(true)
    expect(companyMatches('Acme', 'Acme Foods')).toBe(true)
    expect(companyMatches('Acme', 'Zynga')).toBe(false)
    expect(companyMatches('', 'Acme')).toBe(false)
    expect(companyMatches('Acme', '')).toBe(false)
    expect(companyMatches('Pvt Ltd', 'Acme')).toBe(false) // normalizes to empty
  })
})

describe('gepirLookup', () => {
  it('returns null when GEPIR is unconfigured', async () => {
    expect(await gepirLookup(envWith(''), '890')).toBeNull()
  })

  it('resolves a party from the proxy', async () => {
    stub('890', 200, { company_name: 'Acme' })
    expect(await gepirLookup(envWith('https://g.test'), '890')).toEqual({ company_name: 'Acme' })
  })

  it('strips a trailing slash on the base url', async () => {
    stub('894', 200, { company_name: 'Acme' })
    expect(await gepirLookup(envWith('https://g.test/'), '894')).toEqual({ company_name: 'Acme' })
  })

  it('returns null on a 404', async () => {
    stub('891', 404, {})
    expect(await gepirLookup(envWith('https://g.test'), '891')).toBeNull()
  })

  it('returns null on a malformed body', async () => {
    stub('892', 200, { gln: 'x' })
    expect(await gepirLookup(envWith('https://g.test'), '892')).toBeNull()
  })

  it('returns null when the request throws (net disabled, no interceptor)', async () => {
    expect(await gepirLookup(envWith('https://blocked.test'), '893')).toBeNull()
  })
})

describe('autoVerifyClaim', () => {
  const brand = { name: 'CoolBrand', manufacturer: 'Acme Foods Pvt Ltd' }

  it('is unverified when no party is found', async () => {
    expect(await autoVerifyClaim(envWith(''), '890', 'X', brand)).toEqual({ verified: false, gepir_company: '' })
  })

  it('verifies on a claimed-company match', async () => {
    stub('8a', 200, { company_name: 'Acme Foods' })
    expect(await autoVerifyClaim(envWith('https://g.test'), '8a', 'Acme Foods', brand)).toEqual({ verified: true, gepir_company: 'Acme Foods' })
  })

  it('verifies on a manufacturer match', async () => {
    stub('8b', 200, { company_name: 'Acme Foods' })
    expect(await autoVerifyClaim(envWith('https://g.test'), '8b', 'Wrong Co', brand)).toMatchObject({ verified: true })
  })

  it('verifies on a brand-name match', async () => {
    stub('8c', 200, { company_name: 'CoolBrand' })
    expect(await autoVerifyClaim(envWith('https://g.test'), '8c', 'Wrong Co', { name: 'CoolBrand', manufacturer: '' })).toMatchObject({ verified: true })
  })

  it('is unverified on a mismatch', async () => {
    stub('8d', 200, { company_name: 'Other Corp' })
    expect(await autoVerifyClaim(envWith('https://g.test'), '8d', 'Wrong Co', { name: 'X', manufacturer: 'Y' })).toEqual({ verified: false, gepir_company: 'Other Corp' })
  })
})
