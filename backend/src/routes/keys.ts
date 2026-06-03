import { createRoute, z } from '@hono/zod-openapi'
import { newOpenAPIApp } from '../openapi/app'
import { developerAuth } from '../openapi/middleware'
import {
  CreateKeySchema,
  CreatedKeySchema,
  ErrorSchema,
  KeysListSchema,
  RevokeResponseSchema,
} from '../openapi/schemas'
import type { ApiKeyRow } from '../db/accounts'
import { createAccountsStore } from '../db/accounts'
import { generateApiKey } from '../lib/apikey'
import { ulid } from '../lib/ulid'

const app = newOpenAPIApp()
app.use('/v1/keys', developerAuth)
app.use('/v1/keys/*', developerAuth)

const jsonError = (description: string) => ({ content: { 'application/json': { schema: ErrorSchema } }, description })

function toKeyView(k: ApiKeyRow) {
  return {
    id: k.id,
    prefix: k.prefix,
    name: k.name,
    revoked: k.revoked !== 0,
    request_count: k.request_count,
    last_used_at: k.last_used_at,
    created_at: k.created_at,
  }
}

const createKeyRoute = createRoute({
  method: 'post',
  path: '/v1/keys',
  tags: ['Keys'],
  summary: 'Create an API key',
  security: [{ DevBearer: [] }],
  request: { body: { required: true, content: { 'application/json': { schema: CreateKeySchema } } } },
  responses: {
    201: { content: { 'application/json': { schema: CreatedKeySchema } }, description: 'Created — plaintext key shown once' },
    401: jsonError('Unauthorized'),
    422: jsonError('Validation failed'),
  },
})

app.openapi(createKeyRoute, async (c) => {
  const { name } = c.req.valid('json')
  const gen = await generateApiKey()
  const id = ulid()
  const now = new Date().toISOString()
  await createAccountsStore(c.env.DB).createApiKey({
    id,
    developerId: c.get('developerId'),
    prefix: gen.prefix,
    keyHash: gen.hash,
    name,
    now,
  })
  return c.json({ id, name, prefix: gen.prefix, key: gen.plaintext, created_at: now }, 201)
})

const listKeysRoute = createRoute({
  method: 'get',
  path: '/v1/keys',
  tags: ['Keys'],
  summary: 'List your API keys',
  security: [{ DevBearer: [] }],
  responses: {
    200: { content: { 'application/json': { schema: KeysListSchema } }, description: 'OK' },
    401: jsonError('Unauthorized'),
  },
})

app.openapi(listKeysRoute, async (c) => {
  const keys = await createAccountsStore(c.env.DB).listApiKeys(c.get('developerId'))
  return c.json({ keys: keys.map(toKeyView) }, 200)
})

const revokeKeyRoute = createRoute({
  method: 'post',
  path: '/v1/keys/{id}/revoke',
  tags: ['Keys'],
  summary: 'Revoke an API key',
  security: [{ DevBearer: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: RevokeResponseSchema } }, description: 'OK' },
    401: jsonError('Unauthorized'),
    404: jsonError('Key not found'),
  },
})

app.openapi(revokeKeyRoute, async (c) => {
  const { id } = c.req.valid('param')
  const revoked = await createAccountsStore(c.env.DB).revokeApiKey(id, c.get('developerId'))
  if (!revoked) return c.json({ error: 'not_found' }, 404)
  return c.json({ revoked: true }, 200)
})

export default app
