import { Hono } from 'hono'
import type { Env } from '../env'
import { createD1Store } from '../db/queries'

// Public discovery routes: search + brand browse. No auth (read-only, approved rows).
const router = new Hono<{ Bindings: Env }>()

function clampLimit(raw: string | undefined, def: number, max: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return def
  return Math.min(Math.floor(n), max)
}

// GET /v1/search?q=&limit=
router.get('/search', async (c) => {
  const q = (c.req.query('q') ?? '').trim()
  if (q.length < 2) return c.json({ error: 'query_too_short' }, 400)
  const limit = clampLimit(c.req.query('limit'), 30, 100)
  const store = createD1Store(c.env.DB)
  return c.json({ query: q, results: await store.searchProducts(q, limit) })
})

// GET /v1/brands?limit=
router.get('/brands', async (c) => {
  const limit = clampLimit(c.req.query('limit'), 100, 500)
  const store = createD1Store(c.env.DB)
  return c.json({ brands: await store.listBrands(limit) })
})

// GET /v1/brand/:slug?limit=
router.get('/brand/:slug', async (c) => {
  const slug = c.req.param('slug')
  const limit = clampLimit(c.req.query('limit'), 30, 100)
  const store = createD1Store(c.env.DB)
  return c.json({ slug, results: await store.productsByBrand(slug, limit) })
})

export default router
