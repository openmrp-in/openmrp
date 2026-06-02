import { describe, it, expect } from 'vitest'
import { mapCreateProductError } from '../src/lib/errors'

describe('mapCreateProductError', () => {
  it('maps a UNIQUE-constraint failure to 409 conflict', () => {
    const e = mapCreateProductError(new Error('D1_ERROR: UNIQUE constraint failed: variants.barcode'))
    expect(e.status).toBe(409)
    expect(e.body.error).toBe('conflict')
  })

  it('maps any other Error to 500', () => {
    const e = mapCreateProductError(new Error('something unexpected'))
    expect(e.status).toBe(500)
    expect(e.body.error).toBe('internal_error')
  })

  it('maps a non-Error throw to 500', () => {
    const e = mapCreateProductError('weird string throw')
    expect(e.status).toBe(500)
  })
})
