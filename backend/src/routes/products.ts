import { createRoute } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import { isAdmin, newOpenAPIApp, type AppEnv } from '../openapi/app'
import {
  BulkRequestSchema,
  BulkResponseSchema,
  CreateProductSchema,
  CreatedResponseSchema,
  ErrorSchema,
} from '../openapi/schemas'
import { createD1Store } from '../db/queries'
import { mapCreateProductError } from '../lib/errors'
import { normalizeSeedItem, type SeedItem } from '../lib/seed'

const app = newOpenAPIApp()

// Admin gate — runs BEFORE request validation, so auth failures are 401 (not 422).
const adminGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!isAdmin(c)) return c.json({ error: 'unauthorized' }, 401)
  await next()
}
app.use('/v1/products', adminGuard)
app.use('/v1/products/bulk', adminGuard)

const jsonError = (description: string) => ({
  content: { 'application/json': { schema: ErrorSchema } },
  description,
})

const createProductRoute = createRoute({
  method: 'post',
  path: '/v1/products',
  tags: ['Admin'],
  summary: 'Create a product',
  description: 'Admin-only. Creates a product with optional brand, variants and per-language translations.',
  security: [{ AdminKey: [] }],
  request: { body: { required: true, content: { 'application/json': { schema: CreateProductSchema } } } },
  responses: {
    201: { content: { 'application/json': { schema: CreatedResponseSchema } }, description: 'Created' },
    401: jsonError('Missing or invalid admin key'),
    409: jsonError('Duplicate barcode or brand slug'),
    422: jsonError('Validation failed'),
    500: jsonError('Internal error'),
  },
})

app.openapi(createProductRoute, async (c) => {
  const value = c.req.valid('json')
  const store = createD1Store(c.env.DB)
  try {
    const created = await store.createProduct(value)
    return c.json(
      {
        created: true,
        product: created.product,
        brand: created.brand,
        variants: created.variants,
        translations: created.translations,
        brand_translations: created.brand_translations,
      },
      201,
    )
  } catch (err) {
    const mapped = mapCreateProductError(err)
    return c.json(mapped.body, mapped.status)
  }
})

const bulkRoute = createRoute({
  method: 'post',
  path: '/v1/products/bulk',
  tags: ['Admin'],
  summary: 'Bulk-upsert products (seed)',
  description: 'Admin-only. Idempotent by barcode: inserts new, refreshes source=off, skips shop-improved. Invalid items are counted, not rejected.',
  security: [{ AdminKey: [] }],
  request: { body: { required: true, content: { 'application/json': { schema: BulkRequestSchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: BulkResponseSchema } }, description: 'Upserted' },
    401: jsonError('Missing or invalid admin key'),
    422: jsonError('Validation failed'),
  },
})

app.openapi(bulkRoute, async (c) => {
  const { items: raw } = c.req.valid('json')
  const items: SeedItem[] = []
  let invalid = 0
  for (const r of raw) {
    const normalized = normalizeSeedItem(r)
    if (normalized) items.push(normalized)
    else invalid++
  }
  const store = createD1Store(c.env.DB)
  const result = await store.bulkUpsert(items)
  return c.json({ ok: true, ...result, invalid }, 200)
})

export default app
