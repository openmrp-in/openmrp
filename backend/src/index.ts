import { createRoute } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import { cors } from 'hono/cors'
import { newOpenAPIApp } from './openapi/app'
import { HealthSchema } from './openapi/schemas'
import adminApp from './routes/admin'
import authApp from './routes/auth'
import claimsApp from './routes/claims'
import contributionsApp from './routes/contributions'
import discoverApp from './routes/discover'
import dumpApp from './routes/dump'
import pricesApp from './routes/prices'
import type { Env } from './env'
import { runExport } from './dump/export'
import keysApp from './routes/keys'
import productApp from './routes/product'
import productsApp from './routes/products'

const app = newOpenAPIApp()

// Public API: allow browsers (the developer portal + any consumer) to call it.
app.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key', 'X-Admin-Key'],
    allowMethods: ['GET', 'POST'],
  }),
)

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
app.route('/', authApp)
app.route('/', keysApp)
app.route('/', contributionsApp)
app.route('/', claimsApp)
app.route('/', dumpApp)
app.route('/', pricesApp)
app.route('/', adminApp)

// Security schemes (documented on the relevant endpoints).
app.openAPIRegistry.registerComponent('securitySchemes', 'AdminKey', {
  type: 'apiKey',
  in: 'header',
  name: 'X-Admin-Key',
})
app.openAPIRegistry.registerComponent('securitySchemes', 'DevBearer', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
})
app.openAPIRegistry.registerComponent('securitySchemes', 'ApiKey', {
  type: 'apiKey',
  in: 'header',
  name: 'X-Api-Key',
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

// Cron trigger (see wrangler.toml [triggers]) regenerates the open-data dump.
const scheduled: ExportedHandlerScheduledHandler<Env> = (_event, env, ctx) => {
  ctx.waitUntil(runExport(env.DB, env.DUMP, new Date().toISOString()))
}

export default { fetch: app.fetch, scheduled }
