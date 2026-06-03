import { createRoute, z } from '@hono/zod-openapi'
import { newOpenAPIApp } from '../openapi/app'
import {
  BrandProductsResponseSchema,
  BrandsResponseSchema,
  ErrorSchema,
  SearchResponseSchema,
} from '../openapi/schemas'
import { apiKeyAuth } from '../openapi/middleware'
import { createD1Store } from '../db/queries'
import { clampLimit } from '../lib/limit'

const app = newOpenAPIApp()
app.use('/v1/search', apiKeyAuth)
app.use('/v1/brands', apiKeyAuth)
app.use('/v1/brand/*', apiKeyAuth)

const security = [{ ApiKey: [] }]
const keyErrors = {
  401: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Missing/invalid API key' },
  429: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Rate limit exceeded' },
}
const limitQuery = z.string().optional().openapi({ description: 'Max results (clamped)', example: '30' })

const searchRoute = createRoute({
  method: 'get',
  path: '/v1/search',
  tags: ['Discovery'],
  summary: 'Search products by name',
  security,
  request: { query: z.object({ q: z.string().trim().min(2).openapi({ example: 'parle' }), limit: limitQuery }) },
  responses: {
    200: { content: { 'application/json': { schema: SearchResponseSchema } }, description: 'Results' },
    422: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Query too short / missing' },
    ...keyErrors,
  },
})

app.openapi(searchRoute, async (c) => {
  const { q, limit } = c.req.valid('query')
  const store = createD1Store(c.env.DB)
  return c.json({ query: q, results: await store.searchProducts(q, clampLimit(limit, 30, 100)) }, 200)
})

const brandsRoute = createRoute({
  method: 'get',
  path: '/v1/brands',
  tags: ['Discovery'],
  summary: 'List brands',
  security,
  request: { query: z.object({ limit: limitQuery }) },
  responses: { 200: { content: { 'application/json': { schema: BrandsResponseSchema } }, description: 'Brands' }, ...keyErrors },
})

app.openapi(brandsRoute, async (c) => {
  const { limit } = c.req.valid('query')
  const store = createD1Store(c.env.DB)
  return c.json({ brands: await store.listBrands(clampLimit(limit, 100, 500)) }, 200)
})

const brandRoute = createRoute({
  method: 'get',
  path: '/v1/brand/{slug}',
  tags: ['Discovery'],
  summary: 'Products for a brand',
  security,
  request: {
    params: z.object({ slug: z.string().openapi({ param: { name: 'slug', in: 'path' }, example: 'parle' }) }),
    query: z.object({ limit: limitQuery }),
  },
  responses: { 200: { content: { 'application/json': { schema: BrandProductsResponseSchema } }, description: 'Products' }, ...keyErrors },
})

app.openapi(brandRoute, async (c) => {
  const { slug } = c.req.valid('param')
  const { limit } = c.req.valid('query')
  const store = createD1Store(c.env.DB)
  return c.json({ slug, results: await store.productsByBrand(slug, clampLimit(limit, 30, 100)) }, 200)
})

export default app
