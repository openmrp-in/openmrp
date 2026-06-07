import { createRoute, z } from '@hono/zod-openapi'
import { newOpenAPIApp, type AppEnv } from '../openapi/app'
import { developerAuth } from '../openapi/middleware'
import {
  ApprovePriceResultSchema,
  ErrorSchema,
  OkSchema,
  PriceReportSchema,
  PriceReportsListSchema,
  SubmitPriceResultSchema,
  SubmitPriceSchema,
} from '../openapi/schemas'
import { createRolesStore } from '../db/roles'
import { createPricesStore } from '../db/prices'
import { clampLimit } from '../lib/limit'

const app = newOpenAPIApp()
app.use('/v1/prices', developerAuth)
app.use('/v1/prices/*', developerAuth)

const idParam = z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) })
const jsonError = (description: string) => ({ content: { 'application/json': { schema: ErrorSchema } }, description })
const isReviewer = async (c: { env: AppEnv['Bindings'] }, id: string): Promise<boolean> => {
  const roles = createRolesStore(c.env.DB)
  return (await roles.hasRole(id, 'contributor')) || (await roles.hasRole(id, 'admin'))
}

// ─── Report an MRP (from the pack) ───────────────────────────────────────────
const submitRoute = createRoute({
  method: 'post',
  path: '/v1/prices',
  tags: ['Prices'],
  summary: 'Report a product MRP (read from the pack)',
  description:
    'Report the MRP printed on the pack (or, as a brand owner, the official price). Brand owners apply instantly; everyone else needs two approvals. Do NOT scrape prices from commercial sites — report what you read on the physical pack.',
  security: [{ DevBearer: [] }],
  request: { body: { required: true, content: { 'application/json': { schema: SubmitPriceSchema } } } },
  responses: {
    201: { content: { 'application/json': { schema: SubmitPriceResultSchema } }, description: 'Submitted' },
    401: jsonError('Unauthorized'),
    403: jsonError('Not allowed to contribute'),
    404: jsonError('Barcode not found'),
    422: jsonError('Validation failed'),
  },
})

app.openapi(submitRoute, async (c) => {
  const accountId = c.get('developerId')
  const { barcode, mrp_paise, source, note } = c.req.valid('json')
  const db = c.env.DB
  const store = createPricesStore(db)
  const ref = await store.findVariant(barcode)
  if (!ref) return c.json({ error: 'not_found' }, 404)

  const owner = ref.brand_id !== null && (await createRolesStore(db).isVerifiedOwner(accountId, ref.brand_id))
  if (!owner && !(await isReviewer(c, accountId))) return c.json({ error: 'forbidden' }, 403)

  const result = await store.submit(accountId, ref, mrp_paise, source, note, new Date().toISOString())
  return c.json(result, 201)
})

const mineRoute = createRoute({
  method: 'get',
  path: '/v1/prices/mine',
  tags: ['Prices'],
  summary: 'My price reports',
  security: [{ DevBearer: [] }],
  request: { query: z.object({ limit: z.string().optional() }) },
  responses: { 200: { content: { 'application/json': { schema: PriceReportsListSchema } }, description: 'OK' }, 401: jsonError('Unauthorized') },
})

app.openapi(mineRoute, async (c) => {
  const reports = await createPricesStore(c.env.DB).listByAccount(c.get('developerId'), clampLimit(c.req.valid('query').limit, 50, 200))
  return c.json({ reports }, 200)
})

const queueRoute = createRoute({
  method: 'get',
  path: '/v1/prices',
  tags: ['Prices'],
  summary: 'Pending price-report queue',
  security: [{ DevBearer: [] }],
  request: { query: z.object({ limit: z.string().optional() }) },
  responses: {
    200: { content: { 'application/json': { schema: PriceReportsListSchema } }, description: 'OK' },
    401: jsonError('Unauthorized'),
    403: jsonError('Reviewer role required'),
  },
})

app.openapi(queueRoute, async (c) => {
  if (!(await isReviewer(c, c.get('developerId')))) return c.json({ error: 'forbidden' }, 403)
  const reports = await createPricesStore(c.env.DB).listPending(clampLimit(c.req.valid('query').limit, 50, 200))
  return c.json({ reports }, 200)
})

const detailRoute = createRoute({
  method: 'get',
  path: '/v1/prices/{id}',
  tags: ['Prices'],
  summary: 'Price-report detail',
  security: [{ DevBearer: [] }],
  request: { params: idParam },
  responses: { 200: { content: { 'application/json': { schema: PriceReportSchema } }, description: 'OK' }, 401: jsonError('Unauthorized'), 404: jsonError('Not found') },
})

app.openapi(detailRoute, async (c) => {
  const view = await createPricesStore(c.env.DB).get(c.req.valid('param').id)
  if (!view) return c.json({ error: 'not_found' }, 404)
  return c.json(view, 200)
})

const approveRoute = createRoute({
  method: 'post',
  path: '/v1/prices/{id}/approve',
  tags: ['Prices'],
  summary: 'Approve a pending price report',
  description: 'Two distinct approvals set the MRP. You cannot approve your own.',
  security: [{ DevBearer: [] }],
  request: { params: idParam },
  responses: {
    200: { content: { 'application/json': { schema: ApprovePriceResultSchema } }, description: 'OK' },
    401: jsonError('Unauthorized'),
    403: jsonError('Reviewer role required, or cannot approve own'),
    404: jsonError('Not found'),
    409: jsonError('Already resolved'),
  },
})

app.openapi(approveRoute, async (c) => {
  const accountId = c.get('developerId')
  if (!(await isReviewer(c, accountId))) return c.json({ error: 'forbidden' }, 403)
  const result = await createPricesStore(c.env.DB).approve(c.req.valid('param').id, accountId, new Date().toISOString())
  if (!result.ok) {
    if (result.reason === 'not_found') return c.json({ error: 'not_found' }, 404)
    if (result.reason === 'already_resolved') return c.json({ error: 'already_resolved' }, 409)
    return c.json({ error: 'cannot_approve_own' }, 403)
  }
  return c.json(
    result.status === 'applied' ? { status: result.status, approvals: result.approvals, mrp_paise: result.mrp_paise } : { status: result.status, approvals: result.approvals },
    200,
  )
})

const rejectRoute = createRoute({
  method: 'post',
  path: '/v1/prices/{id}/reject',
  tags: ['Prices'],
  summary: 'Reject (admin) or withdraw (author) a pending price report',
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
  const store = createPricesStore(c.env.DB)
  const row = await store.getRow(c.req.valid('param').id)
  if (!row) return c.json({ error: 'not_found' }, 404)
  const isAdmin = await createRolesStore(c.env.DB).hasRole(accountId, 'admin')
  if (row.account_id !== accountId && !isAdmin) return c.json({ error: 'forbidden' }, 403)
  const res = await store.reject(row.id, accountId, new Date().toISOString())
  /* istanbul ignore if -- @preserve: existence re-checked above; race only */
  if (res === 'not_found') return c.json({ error: 'not_found' }, 404)
  if (res === 'already_resolved') return c.json({ error: 'already_resolved' }, 409)
  return c.json({ ok: true }, 200)
})

export default app
