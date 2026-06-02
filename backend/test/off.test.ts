import { describe, it, expect } from 'vitest'
import { mapOffResponse, createOffClient } from '../src/resolve/off'

describe('mapOffResponse', () => {
  it('maps a found product and keeps only the first brand', () => {
    const s = mapOffResponse('3017620422003', {
      status: 1,
      product: {
        product_name: 'Nutella',
        brands: 'Ferrero, Nutella',
        image_url: 'http://img',
        quantity: '400 g',
      },
    })
    expect(s).not.toBeNull()
    expect(s?.name).toBe('Nutella')
    expect(s?.brand).toBe('Ferrero')
    expect(s?.quantity).toBe('400 g')
  })

  it('defaults brand/image/quantity to empty when absent', () => {
    const s = mapOffResponse('123', { status: 1, product: { product_name: 'Plain' } })
    expect(s).toMatchObject({ name: 'Plain', brand: '', image_url: '', quantity: '' })
  })

  it('returns null when data is null', () => {
    expect(mapOffResponse('x', null as unknown as { status?: number })).toBeNull()
  })

  it('returns null when status is 0 (not found)', () => {
    expect(mapOffResponse('x', { status: 0 })).toBeNull()
  })

  it('returns null when product is missing', () => {
    expect(mapOffResponse('x', {})).toBeNull()
  })

  it('returns null when product_name is blank', () => {
    expect(mapOffResponse('x', { status: 1, product: { product_name: '   ' } })).toBeNull()
  })

  it('returns null when product_name is absent', () => {
    expect(mapOffResponse('x', { status: 1, product: { brands: 'X' } })).toBeNull()
  })
})

describe('createOffClient', () => {
  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }

  it('returns a suggestion on a found response', async () => {
    const fakeFetch = (async () =>
      jsonResponse({
        status: 1,
        product: { product_name: 'Maggi', brands: 'Nestle', image_url: '', quantity: '70g' },
      })) as unknown as typeof fetch
    const off = createOffClient(fakeFetch)
    const s = await off.lookup('8901058000986')
    expect(s?.name).toBe('Maggi')
    expect(s?.brand).toBe('Nestle')
  })

  it('returns null on a non-ok response (404)', async () => {
    const fakeFetch = (async () => new Response('not found', { status: 404 })) as unknown as typeof fetch
    const off = createOffClient(fakeFetch)
    expect(await off.lookup('0000000000000')).toBeNull()
  })

  it('returns null when fetch throws', async () => {
    const fakeFetch = (async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch
    const off = createOffClient(fakeFetch)
    expect(await off.lookup('0000000000000')).toBeNull()
  })

  it('returns null when the request times out (abort fires)', async () => {
    const hangingFetch = ((_url: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      })) as unknown as typeof fetch
    const off = createOffClient(hangingFetch, 5)
    expect(await off.lookup('123')).toBeNull()
  })
})
