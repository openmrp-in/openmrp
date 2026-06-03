import { createRoute, z } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import { isAdmin, newOpenAPIApp, type AppEnv } from '../openapi/app'
import { AdminDevelopersSchema, AdminKeysSchema, ErrorSchema } from '../openapi/schemas'
import { createAccountsStore } from '../db/accounts'
import { clampLimit } from '../lib/limit'

const app = newOpenAPIApp()

const adminGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!isAdmin(c)) return c.json({ error: 'unauthorized' }, 401)
  await next()
}
app.use('/v1/admin/*', adminGuard)

const limitQuery = z.string().optional().openapi({ description: 'Max rows (default 100, max 500)' })
const unauthorized = { content: { 'application/json': { schema: ErrorSchema } }, description: 'Unauthorized' }

const developersRoute = createRoute({
  method: 'get',
  path: '/v1/admin/developers',
  tags: ['Admin'],
  summary: 'List all developers',
  security: [{ AdminKey: [] }],
  request: { query: z.object({ limit: limitQuery }) },
  responses: {
    200: { content: { 'application/json': { schema: AdminDevelopersSchema } }, description: 'OK' },
    401: unauthorized,
  },
})

app.openapi(developersRoute, async (c) => {
  const { limit } = c.req.valid('query')
  const devs = await createAccountsStore(c.env.DB).adminListDevelopers(clampLimit(limit, 100, 500))
  return c.json(
    {
      developers: devs.map((d) => ({
        id: d.id,
        email: d.email,
        name: d.name,
        key_count: d.key_count,
        created_at: d.created_at,
      })),
    },
    200,
  )
})

const keysRoute = createRoute({
  method: 'get',
  path: '/v1/admin/keys',
  tags: ['Admin'],
  summary: 'List all API keys',
  security: [{ AdminKey: [] }],
  request: { query: z.object({ limit: limitQuery }) },
  responses: {
    200: { content: { 'application/json': { schema: AdminKeysSchema } }, description: 'OK' },
    401: unauthorized,
  },
})

app.openapi(keysRoute, async (c) => {
  const { limit } = c.req.valid('query')
  const keys = await createAccountsStore(c.env.DB).adminListKeys(clampLimit(limit, 100, 500))
  return c.json(
    {
      keys: keys.map((k) => ({
        id: k.id,
        developer_id: k.developer_id,
        prefix: k.prefix,
        name: k.name,
        revoked: k.revoked !== 0,
        request_count: k.request_count,
        last_used_at: k.last_used_at,
        created_at: k.created_at,
      })),
    },
    200,
  )
})

export default app
