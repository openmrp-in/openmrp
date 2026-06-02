export interface ApiError {
  status: 409 | 500
  body: Record<string, unknown>
}

/**
 * Map a `createProduct` failure to an HTTP error. A UNIQUE-constraint violation is
 * a client conflict (duplicate barcode or brand slug) → 409; anything else → 500.
 */
export function mapCreateProductError(err: unknown): ApiError {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('UNIQUE constraint failed')) {
    return {
      status: 409,
      body: { error: 'conflict', detail: 'a product with this barcode or brand slug already exists' },
    }
  }
  return { status: 500, body: { error: 'internal_error' } }
}
