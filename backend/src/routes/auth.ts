import { createRoute } from '@hono/zod-openapi'
import { sign } from 'hono/jwt'
import { newOpenAPIApp } from '../openapi/app'
import { developerAuth } from '../openapi/middleware'
import {
  AuthResponseSchema,
  DeveloperViewSchema,
  ErrorSchema,
  LoginSchema,
  RegisterSchema,
} from '../openapi/schemas'
import { createAccountsStore } from '../db/accounts'
import { hashPassword, verifyPassword } from '../lib/password'
import { ulid } from '../lib/ulid'

const app = newOpenAPIApp()

const jsonError = (description: string) => ({ content: { 'application/json': { schema: ErrorSchema } }, description })

const registerRoute = createRoute({
  method: 'post',
  path: '/v1/auth/register',
  tags: ['Auth'],
  summary: 'Register a developer account',
  request: { body: { required: true, content: { 'application/json': { schema: RegisterSchema } } } },
  responses: {
    201: { content: { 'application/json': { schema: AuthResponseSchema } }, description: 'Registered (returns a session token)' },
    409: jsonError('Email already registered'),
    422: jsonError('Validation failed'),
  },
})

app.openapi(registerRoute, async (c) => {
  const { email, password, name } = c.req.valid('json')
  const accounts = createAccountsStore(c.env.DB)
  if (await accounts.findDeveloperByEmail(email)) return c.json({ error: 'email_taken' }, 409)
  const id = ulid()
  const now = new Date().toISOString()
  await accounts.createDeveloper({ id, email, passwordHash: await hashPassword(password), name, now })
  const token = await sign({ sub: id, email }, c.env.JWT_SECRET)
  return c.json({ token, developer: { id, email, name, created_at: now } }, 201)
})

const loginRoute = createRoute({
  method: 'post',
  path: '/v1/auth/login',
  tags: ['Auth'],
  summary: 'Log in',
  request: { body: { required: true, content: { 'application/json': { schema: LoginSchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: AuthResponseSchema } }, description: 'OK' },
    401: jsonError('Invalid credentials'),
    422: jsonError('Validation failed'),
  },
})

app.openapi(loginRoute, async (c) => {
  const { email, password } = c.req.valid('json')
  const dev = await createAccountsStore(c.env.DB).findDeveloperByEmail(email)
  if (!dev || !(await verifyPassword(password, dev.password_hash))) {
    return c.json({ error: 'invalid_credentials' }, 401)
  }
  const token = await sign({ sub: dev.id, email: dev.email }, c.env.JWT_SECRET)
  return c.json({ token, developer: { id: dev.id, email: dev.email, name: dev.name, created_at: dev.created_at } }, 200)
})

app.use('/v1/auth/me', developerAuth)
const meRoute = createRoute({
  method: 'get',
  path: '/v1/auth/me',
  tags: ['Auth'],
  summary: 'Current developer',
  security: [{ DevBearer: [] }],
  responses: {
    200: { content: { 'application/json': { schema: DeveloperViewSchema } }, description: 'OK' },
    401: jsonError('Unauthorized'),
  },
})

app.openapi(meRoute, async (c) => {
  const dev = await createAccountsStore(c.env.DB).findDeveloperById(c.get('developerId'))
  /* istanbul ignore if -- @preserve: defensive; a valid token implies the developer exists */
  if (!dev) return c.json({ error: 'unauthorized' }, 401)
  return c.json({ id: dev.id, email: dev.email, name: dev.name, created_at: dev.created_at }, 200)
})

export default app
