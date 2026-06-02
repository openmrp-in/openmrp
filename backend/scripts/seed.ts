/**
 * Seed OpenMRP from cached Open Food Facts pages (e.g. CliqBill's .off-cache/).
 *
 * Each page file is JSON `{ items: CacheItem[], total }`. Items are mapped to the
 * bulk wire shape and POSTed to /v1/products/bulk in batches. Idempotent — re-runs
 * refresh `source='off'` rows and skip shop-improved ones.
 *
 * Run the backend first (`npm run dev`), then:
 *   npm run seed -- --cache ../../.off-cache --url http://127.0.0.1:8787 \
 *     --admin-key local-dev-admin-key-change-me --batch 200 --limit 0
 *
 * --limit 0 = seed everything; a positive value caps it (handy for a smoke test).
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { cacheItemToSeedItem, type CacheItem } from '../src/lib/seed'

interface Args {
  cache: string
  url: string
  adminKey: string
  batch: number
  limit: number
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string, def: string): string => {
    const i = argv.indexOf(flag)
    return i >= 0 && argv[i + 1] ? argv[i + 1] : def
  }
  return {
    cache: get('--cache', '../../.off-cache'),
    url: get('--url', 'http://127.0.0.1:8787'),
    adminKey: get('--admin-key', 'local-dev-admin-key-change-me'),
    batch: Number(get('--batch', '200')),
    limit: Number(get('--limit', '0')),
  }
}

interface BulkResponse {
  inserted: number
  refreshed: number
  skipped: number
  invalid: number
}

async function postBatch(args: Args, items: Record<string, unknown>[]): Promise<BulkResponse> {
  const res = await fetch(`${args.url}/v1/products/bulk`, {
    method: 'POST',
    headers: { 'X-Admin-Key': args.adminKey, 'content-type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  if (!res.ok) throw new Error(`bulk POST failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as BulkResponse
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const files = (await readdir(args.cache))
    .filter((f) => f.startsWith('page-') && f.endsWith('.json'))
    .sort()
  console.log(`seeding from ${files.length} cache pages at ${args.cache} -> ${args.url}`)

  const totals: BulkResponse = { inserted: 0, refreshed: 0, skipped: 0, invalid: 0 }
  let buffer: Record<string, unknown>[] = []
  let seen = 0
  let stop = false

  const flush = async (): Promise<void> => {
    if (buffer.length === 0) return
    const r = await postBatch(args, buffer)
    totals.inserted += r.inserted
    totals.refreshed += r.refreshed
    totals.skipped += r.skipped
    totals.invalid += r.invalid
    process.stdout.write(
      `  +${r.inserted} ~${r.refreshed} =${r.skipped} !${r.invalid}  (inserted total ${totals.inserted})\r`,
    )
    buffer = []
  }

  for (const file of files) {
    const page = JSON.parse(await readFile(join(args.cache, file), 'utf8')) as { items?: CacheItem[] }
    for (const raw of page.items ?? []) {
      buffer.push(cacheItemToSeedItem(raw))
      seen++
      if (buffer.length >= args.batch) await flush()
      if (args.limit > 0 && seen >= args.limit) {
        stop = true
        break
      }
    }
    if (stop) break
  }
  await flush()

  console.log(
    `\ndone — inserted=${totals.inserted} refreshed=${totals.refreshed} skipped=${totals.skipped} invalid=${totals.invalid}`,
  )
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
