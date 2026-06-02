import { Hono } from 'hono'
import type { Env } from '../env'
import { createD1Store } from '../db/queries'
import { createOffClient } from '../resolve/off'
import { resolveBarcode } from '../resolve/resolve'

// GET /v1/product/:barcode  — the resolve chain (crowd → OFF → not-found).
const router = new Hono<{ Bindings: Env }>()

router.get('/:barcode', async (c) => {
  const barcode = c.req.param('barcode')
  const store = createD1Store(c.env.DB)
  const off = createOffClient()
  const result = await resolveBarcode(barcode, store, off)
  return c.json(result, result.found ? 200 : 404)
})

export default router
