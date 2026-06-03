import { createRoute, z } from '@hono/zod-openapi'
import { newOpenAPIApp } from '../openapi/app'
import { apiKeyAuth } from '../openapi/middleware'
import { ErrorSchema, ResolveResultSchema } from '../openapi/schemas'
import { createD1Store } from '../db/queries'
import { createOffClient } from '../resolve/off'
import { resolveBarcode } from '../resolve/resolve'

const app = newOpenAPIApp()
app.use('/v1/product/*', apiKeyAuth)

const resolveRoute = createRoute({
  method: 'get',
  path: '/v1/product/{barcode}',
  tags: ['Products'],
  summary: 'Resolve a barcode',
  description: 'Looks up a barcode in the crowd database, falling back to an Open Food Facts suggestion (no MRP), else 404.',
  security: [{ ApiKey: [] }],
  request: {
    params: z.object({
      barcode: z.string().openapi({ param: { name: 'barcode', in: 'path' }, example: '8901719134845' }),
    }),
  },
  responses: {
    200: { content: { 'application/json': { schema: ResolveResultSchema } }, description: 'Found (crowd match or OFF suggestion)' },
    404: { content: { 'application/json': { schema: ResolveResultSchema } }, description: 'Not found' },
    401: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Missing/invalid API key' },
    429: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Rate limit exceeded' },
  },
})

app.openapi(resolveRoute, async (c) => {
  const { barcode } = c.req.valid('param')
  const store = createD1Store(c.env.DB)
  const result = await resolveBarcode(barcode, store, createOffClient())
  return result.found ? c.json(result, 200) : c.json(result, 404)
})

export default app
