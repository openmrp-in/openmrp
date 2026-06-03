import { createRoute, z } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import { isAdmin, newOpenAPIApp, type AppEnv } from '../openapi/app'
import {
  AdminDevelopersSchema,
  AdminKeysSchema,
  EditProductSchema,
  ErrorSchema,
  ProductStateSchema,
  RevertSchema,
  RevertedSchema,
  VersionsListSchema,
} from '../openapi/schemas'
import { createAccountsStore } from '../db/accounts'
import { createD1Store, loadProduct } from '../db/queries'
import { applyProductEdit, countVersions, listVersions, revertToVersion, snapshotVersion } from '../db/versions'
import { clampLimit } from '../lib/limit'

const barcodeParam = z.object({ barcode: z.string().openapi({ param: { name: 'barcode', in: 'path' } }) })
const notFound = { content: { 'application/json': { schema: ErrorSchema } }, description: 'Product not found' }

const app = newOpenAPIApp()

const adminGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!isAdmin(c)) return c.json({ error: 'unauthorized' }, 401)
  await next()
}
app.use('/v1/admin/*', adminGuard)

const limitQuery = z.string().optional().openapi({ description: 'Max rows (default 100, max 500)' })
const unauthorized = { content: { 'application/json': { schema: ErrorSchema } }, description: 'Unauthorized' }

const developersRoute = createRoute({
  method: 'get',
  path: '/v1/admin/developers',
  tags: ['Admin'],
  summary: 'List all developers',
  security: [{ AdminKey: [] }],
  request: { query: z.object({ limit: limitQuery }) },
  responses: {
    200: { content: { 'application/json': { schema: AdminDevelopersSchema } }, description: 'OK' },
    401: unauthorized,
  },
})

app.openapi(developersRoute, async (c) => {
  const { limit } = c.req.valid('query')
  const devs = await createAccountsStore(c.env.DB).adminListDevelopers(clampLimit(limit, 100, 500))
  return c.json(
    {
      developers: devs.map((d) => ({
        id: d.id,
        email: d.email,
        name: d.name,
        key_count: d.key_count,
        created_at: d.created_at,
      })),
    },
    200,
  )
})

const keysRoute = createRoute({
  method: 'get',
  path: '/v1/admin/keys',
  tags: ['Admin'],
  summary: 'List all API keys',
  security: [{ AdminKey: [] }],
  request: { query: z.object({ limit: limitQuery }) },
  responses: {
    200: { content: { 'application/json': { schema: AdminKeysSchema } }, description: 'OK' },
    401: unauthorized,
  },
})

app.openapi(keysRoute, async (c) => {
  const { limit } = c.req.valid('query')
  const keys = await createAccountsStore(c.env.DB).adminListKeys(clampLimit(limit, 100, 500))
  return c.json(
    {
      keys: keys.map((k) => ({
        id: k.id,
        developer_id: k.developer_id,
        prefix: k.prefix,
        name: k.name,
        revoked: k.revoked !== 0,
        request_count: k.request_count,
        last_used_at: k.last_used_at,
        created_at: k.created_at,
      })),
    },
    200,
  )
})

// ─── Product editing + versioning ────────────────────────────────────────────
const editRoute = createRoute({
  method: 'post',
  path: '/v1/admin/products/{barcode}/edit',
  tags: ['Admin'],
  summary: 'Edit a product (full replace of fields + translations)',
  security: [{ AdminKey: [] }],
  request: { params: barcodeParam, body: { required: true, content: { 'application/json': { schema: EditProductSchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: ProductStateSchema } }, description: 'Updated' },
    401: unauthorized,
    404: notFound,
    422: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Validation failed' },
  },
})

app.openapi(editRoute, async (c) => {
  const { barcode } = c.req.valid('param')
  const edit = c.req.valid('json')
  const db = c.env.DB
  const resolved = await createD1Store(db).findByBarcode(barcode)
  if (!resolved) return c.json({ error: 'not_found' }, 404)
  const productId = resolved.product.id
  const now = new Date().toISOString()
  if ((await countVersions(db, productId)) === 0) await snapshotVersion(db, productId, 'baseline', 'admin', now)
  await applyProductEdit(db, productId, edit, now)
  await snapshotVersion(db, productId, 'edit', 'admin', now)
  const updated = (await loadProduct(db, productId))!
  return c.json(
    {
      product: updated.product,
      brand: updated.brand,
      variants: updated.variants,
      translations: updated.translations,
      brand_translations: updated.brand_translations,
    },
    200,
  )
})

const versionsRoute = createRoute({
  method: 'get',
  path: '/v1/admin/products/{barcode}/versions',
  tags: ['Admin'],
  summary: 'List a product version history',
  security: [{ AdminKey: [] }],
  request: { params: barcodeParam },
  responses: {
    200: { content: { 'application/json': { schema: VersionsListSchema } }, description: 'Versions (newest first)' },
    401: unauthorized,
    404: notFound,
  },
})

app.openapi(versionsRoute, async (c) => {
  const { barcode } = c.req.valid('param')
  const db = c.env.DB
  const resolved = await createD1Store(db).findByBarcode(barcode)
  if (!resolved) return c.json({ error: 'not_found' }, 404)
  return c.json({ versions: await listVersions(db, resolved.product.id) }, 200)
})

const revertRoute = createRoute({
  method: 'post',
  path: '/v1/admin/products/{barcode}/revert',
  tags: ['Admin'],
  summary: 'Revert a product to a previous version',
  security: [{ AdminKey: [] }],
  request: { params: barcodeParam, body: { required: true, content: { 'application/json': { schema: RevertSchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: RevertedSchema } }, description: 'Reverted' },
    401: unauthorized,
    404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Product or version not found' },
    422: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Validation failed' },
  },
})

app.openapi(revertRoute, async (c) => {
  const { barcode } = c.req.valid('param')
  const { version } = c.req.valid('json')
  const db = c.env.DB
  const resolved = await createD1Store(db).findByBarcode(barcode)
  if (!resolved) return c.json({ error: 'not_found' }, 404)
  const ok = await revertToVersion(db, resolved.product.id, version, 'admin', new Date().toISOString())
  if (!ok) return c.json({ error: 'version_not_found' }, 404)
  return c.json({ reverted: true, version }, 200)
})

export default app
