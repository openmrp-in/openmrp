import { verify } from 'hono/jwt'
import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from './app'

/** Verify the developer session JWT (Authorization: Bearer …) and set developerId. */
export const developerAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return c.json({ error: 'unauthorized' }, 401)
  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256')
    c.set('developerId', String(payload.sub))
  } catch {
    return c.json({ error: 'unauthorized' }, 401)
  }
  await next()
}
