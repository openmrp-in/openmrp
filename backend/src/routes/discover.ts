import { createRoute, z } from '@hono/zod-openapi'
import { newOpenAPIApp } from '../openapi/app'
import {
  BrandProductsResponseSchema,
  BrandsResponseSchema,
  ErrorSchema,
  SearchResponseSchema,
} from '../openapi/schemas'
import { createD1Store } from '../db/queries'

const app = newOpenAPIApp()

function clampLimit(raw: string | undefined, def: number, max: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return def
  return Math.min(Math.floor(n), max)
}

const limitQuery = z.string().optional().openapi({ description: 'Max results (clamped)', example: '30' })

const searchRoute = createRoute({
  method: 'get',
  path: '/v1/search',
  tags: ['Discovery'],
  summary: 'Search products by name',
  request: { query: z.object({ q: z.string().trim().min(2).openapi({ example: 'parle' }), limit: limitQuery }) },
  responses: {
    200: { content: { 'application/json': { schema: SearchResponseSchema } }, description: 'Results' },
    422: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Query too short / missing' },
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
  request: { query: z.object({ limit: limitQuery }) },
  responses: { 200: { content: { 'application/json': { schema: BrandsResponseSchema } }, description: 'Brands' } },
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
  request: {
    params: z.object({ slug: z.string().openapi({ param: { name: 'slug', in: 'path' }, example: 'parle' }) }),
    query: z.object({ limit: limitQuery }),
  },
  responses: { 200: { content: { 'application/json': { schema: BrandProductsResponseSchema } }, description: 'Products' } },
})

app.openapi(brandRoute, async (c) => {
  const { slug } = c.req.valid('param')
  const { limit } = c.req.valid('query')
  const store = createD1Store(c.env.DB)
  return c.json({ slug, results: await store.productsByBrand(slug, clampLimit(limit, 30, 100)) }, 200)
})

export default app
