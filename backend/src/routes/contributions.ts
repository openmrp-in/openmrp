import { createRoute, z } from '@hono/zod-openapi'
import { newOpenAPIApp, type AppEnv } from '../openapi/app'
import { developerAuth } from '../openapi/middleware'
import {
  ApproveResultSchema,
  ContributionSchema,
  ContributionsListSchema,
  ErrorSchema,
  OkSchema,
  ProductStateSchema,
  SubmitContributionSchema,
  SubmitResultSchema,
} from '../openapi/schemas'
import { createD1Store, loadProduct } from '../db/queries'
import { createRolesStore } from '../db/roles'
import { createContributionsStore } from '../db/contributions'
import { clampLimit } from '../lib/limit'

const app = newOpenAPIApp()

app.use('/v1/contributions', developerAuth)
app.use('/v1/contributions/*', developerAuth)

const idParam = z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) })
const jsonError = (description: string) => ({ content: { 'application/json': { schema: ErrorSchema } }, description })

/** True when the account may take part in moderation (review/approve). */
async function isReviewer(c: { env: AppEnv['Bindings'] }, accountId: string): Promise<boolean> {
  const roles = createRolesStore(c.env.DB)
  return (await roles.hasRole(accountId, 'contributor')) || (await roles.hasRole(accountId, 'admin'))
}

// ─── Submit ───────────────────────────────────────────────────────────────────
const submitRoute = createRoute({
  method: 'post',
  path: '/v1/contributions',
  tags: ['Contributions'],
  summary: 'Propose an edit to a product',
  description:
    'Auto-applies when you are a verified owner of the product brand; otherwise queues for 2 approvals. Requires the contributor role (or brand ownership).',
  security: [{ DevBearer: [] }],
  request: { body: { required: true, content: { 'application/json': { schema: SubmitContributionSchema } } } },
  responses: {
    201: { content: { 'application/json': { schema: SubmitResultSchema } }, description: 'Submitted' },
    401: jsonError('Unauthorized'),
    403: jsonError('Not allowed to contribute'),
    404: jsonError('Product not found'),
    422: jsonError('Validation failed'),
  },
})

app.openapi(submitRoute, async (c) => {
  const accountId = c.get('developerId')
  const { barcode, edit, note } = c.req.valid('json')
  const db = c.env.DB
  const resolved = await createD1Store(db).findByBarcode(barcode)
  if (!resolved) return c.json({ error: 'not_found' }, 404)
  const brandId = resolved.brand?.id ?? null

  const roles = createRolesStore(db)
  const owner = brandId !== null && (await roles.isVerifiedOwner(accountId, brandId))
  const allowed = owner || (await isReviewer(c, accountId))
  if (!allowed) return c.json({ error: 'forbidden' }, 403)

  const result = await createContributionsStore(db).submit(
    accountId,
    resolved.product.id,
    brandId,
    edit,
    note,
    new Date().toISOString(),
  )
  return c.json(result, 201)
})

// ─── Current product state (for prefilling an edit) ──────────────────────────
const productRoute = createRoute({
  method: 'get',
  path: '/v1/contributions/product/{barcode}',
  tags: ['Contributions'],
  summary: 'Current product state, for prefilling an edit',
  security: [{ DevBearer: [] }],
  request: { params: z.object({ barcode: z.string().openapi({ param: { name: 'barcode', in: 'path' } }) }) },
  responses: {
    200: { content: { 'application/json': { schema: ProductStateSchema } }, description: 'OK' },
    401: jsonError('Unauthorized'),
    404: jsonError('Not found'),
  },
})

app.openapi(productRoute, async (c) => {
  const db = c.env.DB
  const resolved = await createD1Store(db).findByBarcode(c.req.valid('param').barcode)
  if (!resolved) return c.json({ error: 'not_found' }, 404)
  const full = (await loadProduct(db, resolved.product.id))!
  return c.json(
    { product: full.product, brand: full.brand, variants: full.variants, translations: full.translations, brand_translations: full.brand_translations },
    200,
  )
})

// ─── My contributions ──────────────────────────────────────────────────────────
const mineRoute = createRoute({
  method: 'get',
  path: '/v1/contributions/mine',
  tags: ['Contributions'],
  summary: 'My contributions',
  security: [{ DevBearer: [] }],
  request: { query: z.object({ limit: z.string().optional() }) },
  responses: {
    200: { content: { 'application/json': { schema: ContributionsListSchema } }, description: 'OK' },
    401: jsonError('Unauthorized'),
  },
})

app.openapi(mineRoute, async (c) => {
  const { limit } = c.req.valid('query')
  const contributions = await createContributionsStore(c.env.DB).listByAccount(
    c.get('developerId'),
    clampLimit(limit, 50, 200),
  )
  return c.json({ contributions }, 200)
})

// ─── Review queue ────────────────────────────────────────────────────────────
const queueRoute = createRoute({
  method: 'get',
  path: '/v1/contributions',
  tags: ['Contributions'],
  summary: 'Pending review queue',
  security: [{ DevBearer: [] }],
  request: { query: z.object({ limit: z.string().optional() }) },
  responses: {
    200: { content: { 'application/json': { schema: ContributionsListSchema } }, description: 'OK' },
    401: jsonError('Unauthorized'),
    403: jsonError('Reviewer role required'),
  },
})

app.openapi(queueRoute, async (c) => {
  if (!(await isReviewer(c, c.get('developerId')))) return c.json({ error: 'forbidden' }, 403)
  const { limit } = c.req.valid('query')
  const contributions = await createContributionsStore(c.env.DB).listPending(clampLimit(limit, 50, 200))
  return c.json({ contributions }, 200)
})

// ─── Detail ──────────────────────────────────────────────────────────────────
const detailRoute = createRoute({
  method: 'get',
  path: '/v1/contributions/{id}',
  tags: ['Contributions'],
  summary: 'Contribution detail',
  security: [{ DevBearer: [] }],
  request: { params: idParam },
  responses: {
    200: { content: { 'application/json': { schema: ContributionSchema } }, description: 'OK' },
    401: jsonError('Unauthorized'),
    404: jsonError('Not found'),
  },
})

app.openapi(detailRoute, async (c) => {
  const view = await createContributionsStore(c.env.DB).get(c.req.valid('param').id)
  if (!view) return c.json({ error: 'not_found' }, 404)
  return c.json(view, 200)
})

// ─── Approve ─────────────────────────────────────────────────────────────────
const approveRoute = createRoute({
  method: 'post',
  path: '/v1/contributions/{id}/approve',
  tags: ['Contributions'],
  summary: 'Approve a pending contribution',
  description: 'Two distinct approvals apply the change. You cannot approve your own.',
  security: [{ DevBearer: [] }],
  request: { params: idParam },
  responses: {
    200: { content: { 'application/json': { schema: ApproveResultSchema } }, description: 'OK' },
    401: jsonError('Unauthorized'),
    403: jsonError('Reviewer role required, or cannot approve own'),
    404: jsonError('Not found'),
    409: jsonError('Already resolved'),
  },
})

app.openapi(approveRoute, async (c) => {
  const accountId = c.get('developerId')
  if (!(await isReviewer(c, accountId))) return c.json({ error: 'forbidden' }, 403)
  const result = await createContributionsStore(c.env.DB).approve(
    c.req.valid('param').id,
    accountId,
    new Date().toISOString(),
  )
  if (!result.ok) {
    if (result.reason === 'not_found') return c.json({ error: 'not_found' }, 404)
    if (result.reason === 'already_resolved') return c.json({ error: 'already_resolved' }, 409)
    return c.json({ error: 'cannot_approve_own' }, 403)
  }
  return c.json(
    result.status === 'applied'
      ? { status: result.status, approvals: result.approvals, version: result.version }
      : { status: result.status, approvals: result.approvals },
    200,
  )
})

// ─── Reject / withdraw ───────────────────────────────────────────────────────
const rejectRoute = createRoute({
  method: 'post',
  path: '/v1/contributions/{id}/reject',
  tags: ['Contributions'],
  summary: 'Reject (admin) or withdraw (author) a pending contribution',
  security: [{ DevBearer: [] }],
  request: { params: idParam },
  responses: {
    200: { content: { 'application/json': { schema: OkSchema } }, description: 'OK' },
    401: jsonError('Unauthorized'),
    403: jsonError('Not allowed'),
    404: jsonError('Not found'),
    409: jsonError('Already resolved'),
  },
})

app.openapi(rejectRoute, async (c) => {
  const accountId = c.get('developerId')
  const store = createContributionsStore(c.env.DB)
  const row = await store.getRow(c.req.valid('param').id)
  if (!row) return c.json({ error: 'not_found' }, 404)
  const isAuthor = row.account_id === accountId
  const isAdmin = await createRolesStore(c.env.DB).hasRole(accountId, 'admin')
  if (!isAuthor && !isAdmin) return c.json({ error: 'forbidden' }, 403)
  const res = await store.reject(row.id, accountId, new Date().toISOString())
  /* istanbul ignore if -- @preserve: row existence re-checked above; race only */
  if (res === 'not_found') return c.json({ error: 'not_found' }, 404)
  if (res === 'already_resolved') return c.json({ error: 'already_resolved' }, 409)
  return c.json({ ok: true }, 200)
})

export default app
