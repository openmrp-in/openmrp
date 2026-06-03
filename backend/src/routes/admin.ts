import { createRoute, z } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import { isAdmin, newOpenAPIApp, type AppEnv } from '../openapi/app'
import {
  AdminDevelopersSchema,
  AdminKeysSchema,
  BrandClaimsListSchema,
  EditProductSchema,
  ErrorSchema,
  GrantBrandOwnerSchema,
  GrantRoleSchema,
  OkSchema,
  ProductStateSchema,
  RevertSchema,
  RevertedSchema,
  RolesListSchema,
  VersionsListSchema,
} from '../openapi/schemas'
import { createAccountsStore } from '../db/accounts'
import { createClaimsStore } from '../db/claims'
import { createD1Store, loadProduct } from '../db/queries'
import { createRolesStore } from '../db/roles'
import { applyProductEdit, countVersions, listVersions, revertToVersion, snapshotVersion } from '../db/versions'
import { clampLimit } from '../lib/limit'

const barcodeParam = z.object({ barcode: z.string().openapi({ param: { name: 'barcode', in: 'path' } }) })
const accountIdParam = z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) })
const notFound = { content: { 'application/json': { schema: ErrorSchema } }, description: 'Product not found' }

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

// ─── Product editing + versioning ────────────────────────────────────────────
const editRoute = createRoute({
  method: 'post',
  path: '/v1/admin/products/{barcode}/edit',
  tags: ['Admin'],
  summary: 'Edit a product (full replace of fields + translations)',
  security: [{ AdminKey: [] }],
  request: { params: barcodeParam, body: { required: true, content: { 'application/json': { schema: EditProductSchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: ProductStateSchema } }, description: 'Updated' },
    401: unauthorized,
    404: notFound,
    422: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Validation failed' },
  },
})

app.openapi(editRoute, async (c) => {
  const { barcode } = c.req.valid('param')
  const edit = c.req.valid('json')
  const db = c.env.DB
  const resolved = await createD1Store(db).findByBarcode(barcode)
  if (!resolved) return c.json({ error: 'not_found' }, 404)
  const productId = resolved.product.id
  const now = new Date().toISOString()
  if ((await countVersions(db, productId)) === 0) await snapshotVersion(db, productId, 'baseline', 'admin', now)
  await applyProductEdit(db, productId, edit, now)
  await snapshotVersion(db, productId, 'edit', 'admin', now)
  const updated = (await loadProduct(db, productId))!
  return c.json(
    {
      product: updated.product,
      brand: updated.brand,
      variants: updated.variants,
      translations: updated.translations,
      brand_translations: updated.brand_translations,
    },
    200,
  )
})

const versionsRoute = createRoute({
  method: 'get',
  path: '/v1/admin/products/{barcode}/versions',
  tags: ['Admin'],
  summary: 'List a product version history',
  security: [{ AdminKey: [] }],
  request: { params: barcodeParam },
  responses: {
    200: { content: { 'application/json': { schema: VersionsListSchema } }, description: 'Versions (newest first)' },
    401: unauthorized,
    404: notFound,
  },
})

app.openapi(versionsRoute, async (c) => {
  const { barcode } = c.req.valid('param')
  const db = c.env.DB
  const resolved = await createD1Store(db).findByBarcode(barcode)
  if (!resolved) return c.json({ error: 'not_found' }, 404)
  return c.json({ versions: await listVersions(db, resolved.product.id) }, 200)
})

const revertRoute = createRoute({
  method: 'post',
  path: '/v1/admin/products/{barcode}/revert',
  tags: ['Admin'],
  summary: 'Revert a product to a previous version',
  security: [{ AdminKey: [] }],
  request: { params: barcodeParam, body: { required: true, content: { 'application/json': { schema: RevertSchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: RevertedSchema } }, description: 'Reverted' },
    401: unauthorized,
    404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Product or version not found' },
    422: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Validation failed' },
  },
})

app.openapi(revertRoute, async (c) => {
  const { barcode } = c.req.valid('param')
  const { version } = c.req.valid('json')
  const db = c.env.DB
  const resolved = await createD1Store(db).findByBarcode(barcode)
  if (!resolved) return c.json({ error: 'not_found' }, 404)
  const ok = await revertToVersion(db, resolved.product.id, version, 'admin', new Date().toISOString())
  if (!ok) return c.json({ error: 'version_not_found' }, 404)
  return c.json({ reverted: true, version }, 200)
})

// ─── Roles + brand ownership ─────────────────────────────────────────────────
const accountNotFound = { content: { 'application/json': { schema: ErrorSchema } }, description: 'Account not found' }

const listRolesRoute = createRoute({
  method: 'get',
  path: '/v1/admin/accounts/{id}/roles',
  tags: ['Admin'],
  summary: "List an account's roles",
  security: [{ AdminKey: [] }],
  request: { params: accountIdParam },
  responses: {
    200: { content: { 'application/json': { schema: RolesListSchema } }, description: 'OK' },
    401: unauthorized,
    404: accountNotFound,
  },
})

app.openapi(listRolesRoute, async (c) => {
  const { id } = c.req.valid('param')
  if (!(await createAccountsStore(c.env.DB).findDeveloperById(id))) return c.json({ error: 'not_found' }, 404)
  return c.json({ roles: await createRolesStore(c.env.DB).listRoles(id) }, 200)
})

const grantRoleRoute = createRoute({
  method: 'post',
  path: '/v1/admin/accounts/{id}/roles',
  tags: ['Admin'],
  summary: 'Grant a role to an account',
  security: [{ AdminKey: [] }],
  request: { params: accountIdParam, body: { required: true, content: { 'application/json': { schema: GrantRoleSchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: RolesListSchema } }, description: 'Updated roles' },
    401: unauthorized,
    404: accountNotFound,
    422: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Validation failed' },
  },
})

app.openapi(grantRoleRoute, async (c) => {
  const { id } = c.req.valid('param')
  const { role } = c.req.valid('json')
  const roles = createRolesStore(c.env.DB)
  if (!(await createAccountsStore(c.env.DB).findDeveloperById(id))) return c.json({ error: 'not_found' }, 404)
  await roles.grantRole(id, role, 'admin', new Date().toISOString())
  return c.json({ roles: await roles.listRoles(id) }, 200)
})

const revokeRoleRoute = createRoute({
  method: 'post',
  path: '/v1/admin/accounts/{id}/roles/revoke',
  tags: ['Admin'],
  summary: 'Revoke a role from an account',
  security: [{ AdminKey: [] }],
  request: { params: accountIdParam, body: { required: true, content: { 'application/json': { schema: GrantRoleSchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: RolesListSchema } }, description: 'Updated roles' },
    401: unauthorized,
    404: accountNotFound,
    422: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Validation failed' },
  },
})

app.openapi(revokeRoleRoute, async (c) => {
  const { id } = c.req.valid('param')
  const { role } = c.req.valid('json')
  const roles = createRolesStore(c.env.DB)
  if (!(await createAccountsStore(c.env.DB).findDeveloperById(id))) return c.json({ error: 'not_found' }, 404)
  await roles.revokeRole(id, role)
  return c.json({ roles: await roles.listRoles(id) }, 200)
})

const grantBrandOwnerRoute = createRoute({
  method: 'post',
  path: '/v1/admin/brand-owners',
  tags: ['Admin'],
  summary: 'Grant verified brand ownership to an account',
  security: [{ AdminKey: [] }],
  request: { body: { required: true, content: { 'application/json': { schema: GrantBrandOwnerSchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: OkSchema } }, description: 'Granted' },
    401: unauthorized,
    404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Account or brand not found' },
    422: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Validation failed' },
  },
})

app.openapi(grantBrandOwnerRoute, async (c) => {
  const { account_id, brand_id, method } = c.req.valid('json')
  const db = c.env.DB
  if (!(await createAccountsStore(db).findDeveloperById(account_id))) return c.json({ error: 'account_not_found' }, 404)
  const brand = await db.prepare('SELECT 1 AS x FROM brands WHERE id = ?').bind(brand_id).first<{ x: number }>()
  if (!brand) return c.json({ error: 'brand_not_found' }, 404)
  const roles = createRolesStore(db)
  const now = new Date().toISOString()
  await roles.grantBrandOwner(account_id, brand_id, method, now)
  await roles.grantRole(account_id, 'brand_owner', 'admin', now)
  return c.json({ ok: true }, 200)
})

// ─── Brand-claim review queue ────────────────────────────────────────────────
const claimIdParam = z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) })
const claimNotFound = { content: { 'application/json': { schema: ErrorSchema } }, description: 'Claim not found' }
const claimResolved = { content: { 'application/json': { schema: ErrorSchema } }, description: 'Already resolved' }

const listClaimsRoute = createRoute({
  method: 'get',
  path: '/v1/admin/brand-claims',
  tags: ['Admin'],
  summary: 'Pending brand-ownership claims',
  security: [{ AdminKey: [] }],
  request: { query: z.object({ limit: limitQuery }) },
  responses: {
    200: { content: { 'application/json': { schema: BrandClaimsListSchema } }, description: 'OK' },
    401: unauthorized,
  },
})

app.openapi(listClaimsRoute, async (c) => {
  const { limit } = c.req.valid('query')
  const claims = await createClaimsStore(c.env.DB).listPending(clampLimit(limit, 100, 500))
  return c.json({ claims }, 200)
})

const approveClaimRoute = createRoute({
  method: 'post',
  path: '/v1/admin/brand-claims/{id}/approve',
  tags: ['Admin'],
  summary: 'Approve a brand-ownership claim (manual grant)',
  security: [{ AdminKey: [] }],
  request: { params: claimIdParam },
  responses: {
    200: { content: { 'application/json': { schema: OkSchema } }, description: 'Approved' },
    401: unauthorized,
    404: claimNotFound,
    409: claimResolved,
  },
})

app.openapi(approveClaimRoute, async (c) => {
  const { id } = c.req.valid('param')
  const db = c.env.DB
  const store = createClaimsStore(db)
  const claim = await store.get(id)
  if (!claim) return c.json({ error: 'not_found' }, 404)
  const now = new Date().toISOString()
  if (!(await store.resolve(id, 'verified', 'admin', now))) return c.json({ error: 'already_resolved' }, 409)
  const roles = createRolesStore(db)
  await roles.grantBrandOwner(claim.account_id, claim.brand_id, 'admin', now)
  await roles.grantRole(claim.account_id, 'brand_owner', 'admin', now)
  return c.json({ ok: true }, 200)
})

const rejectClaimRoute = createRoute({
  method: 'post',
  path: '/v1/admin/brand-claims/{id}/reject',
  tags: ['Admin'],
  summary: 'Reject a brand-ownership claim',
  security: [{ AdminKey: [] }],
  request: { params: claimIdParam },
  responses: {
    200: { content: { 'application/json': { schema: OkSchema } }, description: 'Rejected' },
    401: unauthorized,
    404: claimNotFound,
    409: claimResolved,
  },
})

app.openapi(rejectClaimRoute, async (c) => {
  const { id } = c.req.valid('param')
  const store = createClaimsStore(c.env.DB)
  if (!(await store.get(id))) return c.json({ error: 'not_found' }, 404)
  if (!(await store.resolve(id, 'rejected', 'admin', new Date().toISOString()))) {
    return c.json({ error: 'already_resolved' }, 409)
  }
  return c.json({ ok: true }, 200)
})

export default app
