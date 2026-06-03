import { Hono } from 'hono'
import type { Context } from 'hono'
import type { Env } from '../env'
import { createD1Store } from '../db/queries'
import { mapCreateProductError } from '../lib/errors'
import { normalizeSeedItem, type SeedItem } from '../lib/seed'
import { validateCreateProduct } from '../lib/validate'

const router = new Hono<{ Bindings: Env }>()

function isAdmin(c: Context<{ Bindings: Env }>): boolean {
  const key = c.req.header('X-Admin-Key')
  return !!key && key === c.env.ADMIN_KEY
}

// POST /v1/products — admin-gated single create.
router.post('/', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'unauthorized' }, 401)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }

  const { value, errors } = validateCreateProduct(body)
  if (errors.length > 0) {
    return c.json({ error: 'validation_failed', details: errors }, 422)
  }

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

// POST /v1/products/bulk — admin-gated bulk upsert (seeding).
router.post('/bulk', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'unauthorized' }, 401)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }

  const parsed = (body ?? {}) as { items?: unknown }
  const rawItems = Array.isArray(parsed.items) ? parsed.items : []
  if (rawItems.length === 0) {
    return c.json({ error: 'no_items' }, 422)
  }

  const items: SeedItem[] = []
  let invalid = 0
  for (const raw of rawItems) {
    const normalized = normalizeSeedItem(raw)
    if (normalized) items.push(normalized)
    else invalid++
  }

  const store = createD1Store(c.env.DB)
  const result = await store.bulkUpsert(items)
  return c.json({ ok: true, ...result, invalid }, 200)
})

export default router
