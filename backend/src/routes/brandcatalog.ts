import { createRoute } from '@hono/zod-openapi'
import { newOpenAPIApp } from '../openapi/app'
import { developerAuth } from '../openapi/middleware'
import { BrandCatalogResultSchema, BrandCatalogSchema, ErrorSchema } from '../openapi/schemas'
import { createBrandCatalogStore } from '../db/brandcatalog'

const app = newOpenAPIApp()
app.use('/v1/brand-catalog', developerAuth)

const jsonError = (description: string) => ({ content: { 'application/json': { schema: ErrorSchema } }, description })

const uploadRoute = createRoute({
  method: 'post',
  path: '/v1/brand-catalog',
  tags: ['Brand catalog'],
  summary: 'Upload your brand catalog (verified owner)',
  description:
    'A verified brand owner uploads their own products + MRP. Rows apply authoritatively (approved, source=brand) — no crowd approval. Per-row errors are reported, not fatal.',
  security: [{ DevBearer: [] }],
  request: { body: { required: true, content: { 'application/json': { schema: BrandCatalogSchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: BrandCatalogResultSchema } }, description: 'Applied' },
    401: jsonError('Unauthorized'),
    403: jsonError('Not a verified owner of this brand'),
    404: jsonError('Brand not found'),
    422: jsonError('Validation failed'),
  },
})

app.openapi(uploadRoute, async (c) => {
  const accountId = c.get('developerId')
  const { slug, items } = c.req.valid('json')
  const store = createBrandCatalogStore(c.env.DB)
  const brand = await store.findBrandBySlug(slug)
  if (!brand) return c.json({ error: 'brand_not_found' }, 404)
  if (!(await store.ownsBrand(accountId, brand.id))) return c.json({ error: 'forbidden' }, 403)
  const summary = await store.upsert(brand.id, accountId, items, new Date().toISOString())
  return c.json(summary, 200)
})

export default app
