import { OpenAPIHono } from '@hono/zod-openapi'
import type { Context } from 'hono'
import type { Env } from '../env'

/**
 * OpenAPIHono instance with a shared validation hook: any Zod request-validation
 * failure becomes our standard 422 `{ error: 'validation_failed', details }` shape.
 * Because the Zod schemas ARE the validators AND the OpenAPI spec, docs can't drift.
 */
export type AppEnv = { Bindings: Env; Variables: { developerId: string } }

export function newOpenAPIApp() {
  return new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: 'validation_failed',
            details: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
          },
          422,
        )
      }
    },
  })
}

/** Admin-key gate for write endpoints. */
export function isAdmin(c: Context<AppEnv>): boolean {
  const key = c.req.header('X-Admin-Key')
  return !!key && key === c.env.ADMIN_KEY
}
