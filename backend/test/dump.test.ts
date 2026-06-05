import { SELF, env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'
import worker from '../src/index'
import { runExport } from '../src/dump/export'

const BASE = 'https://openmrp.test'
const ADMIN = { 'X-Admin-Key': 'test-admin-key', 'content-type': 'application/json' }

const createProduct = (barcode: string) =>
  SELF.fetch(`${BASE}/v1/products`, {
    method: 'POST',
    headers: ADMIN,
    body: JSON.stringify({ brand: { name: `B-${barcode}` }, product: { name: 'DumpBase' }, variants: [{ label: '1pc', barcode }] }),
  })

describe('open-data dump', () => {
  it('regenerates the dump and serves the manifest + files', async () => {
    await createProduct('8800000000001')

    const trig = await SELF.fetch(`${BASE}/v1/admin/dump`, { method: 'POST', headers: ADMIN })
    expect(trig.status).toBe(200)
    const manifest = (await trig.json()) as { total_rows: number; files: { path: string; format: string; sha256: string }[] }
    expect(manifest.total_rows).toBeGreaterThanOrEqual(1)
    expect(manifest.files).toHaveLength(11) // 5 tables × (json+csv) + 1 sql
    expect(manifest.files.every((f) => f.sha256.length === 64)).toBe(true)

    const got = await SELF.fetch(`${BASE}/v1/dump/manifest`)
    expect(got.status).toBe(200)
    expect(((await got.json()) as { license: string }).license).toBe('ODbL-1.0')

    const csv = await SELF.fetch(`${BASE}/v1/dump/file/products.csv`)
    expect(csv.status).toBe(200)
    expect(csv.headers.get('content-type')).toContain('text/csv')
    expect(csv.headers.get('content-disposition')).toContain('products.csv')
    expect(await csv.text()).toContain('DumpBase')

    const sql = await SELF.fetch(`${BASE}/v1/dump/file/openmrp.sql`)
    expect(await sql.text()).toContain('INSERT INTO products')
    const mf = await SELF.fetch(`${BASE}/v1/dump/file/manifest.json`)
    expect(mf.status).toBe(200)
    await mf.text() // consume the streamed R2 body
  })

  it('404s before any export and for unknown file names', async () => {
    expect((await SELF.fetch(`${BASE}/v1/dump/manifest`)).status).toBe(404)
    expect((await SELF.fetch(`${BASE}/v1/dump/file/products.json`)).status).toBe(404) // valid name, not exported
    expect((await SELF.fetch(`${BASE}/v1/dump/file/evil.txt`)).status).toBe(404) // not in the allow-list
  })

  it('requires the admin key to trigger an export', async () => {
    expect((await SELF.fetch(`${BASE}/v1/admin/dump`, { method: 'POST' })).status).toBe(401)
  })

  it('runExport writes all files to R2 and the scheduled cron runs it', async () => {
    await createProduct('8800000000002')
    const manifest = await runExport(env.DB, env.DUMP, '2026-02-02T00:00:00.000Z')
    expect(manifest.generated_at).toBe('2026-02-02T00:00:00.000Z')
    const brands = await env.DUMP.get('brands.json')
    expect(brands).not.toBeNull()
    await brands!.text() // consume the streamed body

    // cron path
    const ctx = createExecutionContext()
    await worker.scheduled!({ cron: '0 3 * * 0', scheduledTime: 0, noRetry() {} }, env, ctx)
    await waitOnExecutionContext(ctx)
    const mf = await env.DUMP.get('manifest.json')
    expect(mf).not.toBeNull()
    await mf!.text()
  })
})
