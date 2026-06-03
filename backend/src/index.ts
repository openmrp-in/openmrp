import { createRoute } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import { newOpenAPIApp } from './openapi/app'
import { HealthSchema } from './openapi/schemas'
import discoverApp from './routes/discover'
import productApp from './routes/product'
import productsApp from './routes/products'

const app = newOpenAPIApp()

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['Meta'],
  summary: 'Health check',
  responses: { 200: { content: { 'application/json': { schema: HealthSchema } }, description: 'OK' } },
})
app.openapi(healthRoute, (c) => c.json({ status: 'ok', service: 'openmrp-backend' }, 200))

// Mount the route modules (their OpenAPI defs aggregate into the spec).
app.route('/', productApp)
app.route('/', productsApp)
app.route('/', discoverApp)

// Admin-key security scheme (documented on the write endpoints).
app.openAPIRegistry.registerComponent('securitySchemes', 'AdminKey', {
  type: 'apiKey',
  in: 'header',
  name: 'X-Admin-Key',
})

// The spec + an interactive docs UI.
app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'OpenMRP API',
    version: '0.1.0',
    description: 'Free, open product data for India — barcode resolve, search, brand browse, admin create/seed.',
  },
})
app.get('/docs', Scalar({ url: '/openapi.json' }))

app.notFound((c) => c.json({ error: 'not_found' }, 404))

export default app
