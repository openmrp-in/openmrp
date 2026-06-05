import { createRoute } from '@hono/zod-openapi'
import { isAdmin, newOpenAPIApp } from '../openapi/app'
import { DumpManifestSchema, ErrorSchema } from '../openapi/schemas'
import { MANIFEST_FILE, dumpFiles, runExport } from '../dump/export'

const app = newOpenAPIApp()
const jsonError = (description: string) => ({ content: { 'application/json': { schema: ErrorSchema } }, description })
const FILES = dumpFiles()

// Public: the latest dump manifest (sha256 + row counts + generated date).
const manifestRoute = createRoute({
  method: 'get',
  path: '/v1/dump/manifest',
  tags: ['Dump'],
  summary: 'Latest open-data dump manifest',
  responses: {
    200: { content: { 'application/json': { schema: DumpManifestSchema } }, description: 'OK' },
    404: jsonError('No dump published yet'),
  },
})

app.openapi(manifestRoute, async (c) => {
  const obj = await c.env.DUMP.get(MANIFEST_FILE)
  if (!obj) return c.json({ error: 'not_found' }, 404)
  return c.json(JSON.parse(await obj.text()), 200)
})

// Public file download (plain route — streams a binary/text body from R2).
app.get('/v1/dump/file/:name', async (c) => {
  const name = c.req.param('name')
  const contentType = FILES.get(name)
  if (!contentType) return c.json({ error: 'not_found' }, 404)
  const obj = await c.env.DUMP.get(name)
  if (!obj) return c.json({ error: 'not_found' }, 404)
  return new Response(obj.body, {
    headers: { 'content-type': contentType, 'content-disposition': `attachment; filename="${name}"` },
  })
})

// Admin: trigger a fresh export on demand (the cron does this on a schedule).
const triggerRoute = createRoute({
  method: 'post',
  path: '/v1/admin/dump',
  tags: ['Admin'],
  summary: 'Regenerate the open-data dump now',
  security: [{ AdminKey: [] }],
  responses: {
    200: { content: { 'application/json': { schema: DumpManifestSchema } }, description: 'Generated' },
    401: jsonError('Unauthorized'),
  },
})

app.openapi(triggerRoute, async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'unauthorized' }, 401)
  const manifest = await runExport(c.env.DB, c.env.DUMP, new Date().toISOString())
  return c.json(manifest, 200)
})

export default app
