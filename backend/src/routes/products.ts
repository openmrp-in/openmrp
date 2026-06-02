import { Hono } from 'hono'
import type { Env } from '../env'
import { createD1Store } from '../db/queries'
import { mapCreateProductError } from '../lib/errors'
import { validateCreateProduct } from '../lib/validate'

// POST /v1/products  — admin-gated create (the seed / write path).
const router = new Hono<{ Bindings: Env }>()

router.post('/', async (c) => {
  const adminKey = c.req.header('X-Admin-Key')
  if (!adminKey || adminKey !== c.env.ADMIN_KEY) {
    return c.json({ error: 'unauthorized' }, 401)
  }

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
        variants: created.variants,
        names: created.names,
      },
      201,
    )
  } catch (err) {
    const mapped = mapCreateProductError(err)
    return c.json(mapped.body, mapped.status)
  }
})

export default router
