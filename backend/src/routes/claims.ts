import { createRoute, z } from '@hono/zod-openapi'
import { newOpenAPIApp } from '../openapi/app'
import { developerAuth } from '../openapi/middleware'
import {
  BrandClaimsListSchema,
  ErrorSchema,
  SubmitClaimResultSchema,
  SubmitClaimSchema,
} from '../openapi/schemas'
import { createClaimsStore } from '../db/claims'
import { createRolesStore } from '../db/roles'
import { autoVerifyClaim } from '../lib/gepir'
import { clampLimit } from '../lib/limit'

const app = newOpenAPIApp()

app.use('/v1/brand-claims', developerAuth)
app.use('/v1/brand-claims/*', developerAuth)

const jsonError = (description: string) => ({ content: { 'application/json': { schema: ErrorSchema } }, description })

const submitRoute = createRoute({
  method: 'post',
  path: '/v1/brand-claims',
  tags: ['Brand claims'],
  summary: 'Claim ownership of a brand',
  description:
    'Provide a brand slug + a GTIN under it + your company name. GEPIR auto-verifies the GS1 party; a match grants verified ownership immediately, otherwise the claim waits for admin review.',
  security: [{ DevBearer: [] }],
  request: { body: { required: true, content: { 'application/json': { schema: SubmitClaimSchema } } } },
  responses: {
    201: { content: { 'application/json': { schema: SubmitClaimResultSchema } }, description: 'Submitted' },
    401: jsonError('Unauthorized'),
    404: jsonError('Brand not found'),
    422: jsonError('Validation failed'),
  },
})

app.openapi(submitRoute, async (c) => {
  const accountId = c.get('developerId')
  const { slug, gtin, company } = c.req.valid('json')
  const claims = createClaimsStore(c.env.DB)
  const brand = await claims.findBrandBySlug(slug)
  if (!brand) return c.json({ error: 'brand_not_found' }, 404)

  const { verified, gepir_company } = await autoVerifyClaim(c.env, gtin, company, brand)
  const status: 'verified' | 'pending' = verified ? 'verified' : 'pending'
  const now = new Date().toISOString()
  const claimId = await claims.create({
    accountId,
    brandId: brand.id,
    gtin,
    claimedCompany: company,
    gepirCompany: gepir_company,
    status,
    method: 'gepir',
    resolvedBy: verified ? 'gepir' : '',
    resolvedAt: verified ? now : '',
    now,
  })
  if (verified) {
    const roles = createRolesStore(c.env.DB)
    await roles.grantBrandOwner(accountId, brand.id, 'gepir', now)
    await roles.grantRole(accountId, 'brand_owner', 'gepir', now)
  }
  return c.json({ status, claim_id: claimId, gepir_company }, 201)
})

const mineRoute = createRoute({
  method: 'get',
  path: '/v1/brand-claims/mine',
  tags: ['Brand claims'],
  summary: 'My brand claims',
  security: [{ DevBearer: [] }],
  request: { query: z.object({ limit: z.string().optional() }) },
  responses: {
    200: { content: { 'application/json': { schema: BrandClaimsListSchema } }, description: 'OK' },
    401: jsonError('Unauthorized'),
  },
})

app.openapi(mineRoute, async (c) => {
  const { limit } = c.req.valid('query')
  const claims = await createClaimsStore(c.env.DB).listByAccount(c.get('developerId'), clampLimit(limit, 50, 200))
  return c.json({ claims }, 200)
})

export default app
