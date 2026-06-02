/**
 * Seed OpenMRP with India product FACTS (no MRP, no images).
 *
 * Two sources — OpenMRP is self-sufficient (no external repo needed):
 *   --source off    fetch live from Open Food Facts (default)
 *   --source cache  read pre-fetched page-*.json files from --cache <dir>
 *
 * Run the backend first (`npm run dev`), then e.g.:
 *   npm run seed -- --source off --url http://127.0.0.1:8787 \
 *     --admin-key local-dev-admin-key-change-me --page-size 100 --delay 1000 \
 *     --limit 0 --cache-out .off-cache
 *   npm run seed -- --source cache --cache ../../.off-cache ...
 *
 * Idempotent: re-runs refresh source='off' rows and skip shop-improved ones.
 * --limit 0 = everything; a positive value caps it (handy for a smoke test).
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { cacheItemToSeedItem, type CacheItem } from '../src/lib/seed'
import {
  buildSearchUrl,
  mapOffProduct,
  validBarcode,
  OFF_USER_AGENT,
  type OffSearchResponse,
} from '../src/lib/offsearch'

interface Args {
  source: 'off' | 'cache'
  cache: string
  cacheOut: string
  url: string
  adminKey: string
  batch: number
  limit: number
  pageSize: number
  delay: number
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string, def: string): string => {
    const i = argv.indexOf(flag)
    return i >= 0 && argv[i + 1] ? argv[i + 1] : def
  }
  return {
    source: get('--source', 'off') === 'cache' ? 'cache' : 'off',
    cache: get('--cache', '../../.off-cache'),
    cacheOut: get('--cache-out', ''),
    url: get('--url', 'http://127.0.0.1:8787'),
    adminKey: get('--admin-key', 'local-dev-admin-key-change-me'),
    batch: Number(get('--batch', '200')),
    limit: Number(get('--limit', '0')),
    pageSize: Number(get('--page-size', '100')),
    delay: Number(get('--delay', '1000')),
  }
}

interface BulkResponse {
  inserted: number
  refreshed: number
  skipped: number
  invalid: number
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

async function postBatch(args: Args, items: Record<string, unknown>[]): Promise<BulkResponse> {
  const res = await fetch(`${args.url}/v1/products/bulk`, {
    method: 'POST',
    headers: { 'X-Admin-Key': args.adminKey, 'content-type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  if (!res.ok) throw new Error(`bulk POST failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as BulkResponse
}

/** push returns false once the --limit cap is reached, signalling producers to stop. */
type Push = (item: Record<string, unknown>) => Promise<boolean>

async function seedFromCache(args: Args, push: Push): Promise<void> {
  const files = (await readdir(args.cache))
    .filter((f) => f.startsWith('page-') && f.endsWith('.json'))
    .sort()
  console.log(`seeding from ${files.length} cache pages at ${args.cache}`)
  for (const file of files) {
    const page = JSON.parse(await readFile(join(args.cache, file), 'utf8')) as { items?: CacheItem[] }
    for (const raw of page.items ?? []) {
      if (!(await push(cacheItemToSeedItem(raw)))) return
    }
  }
}

// OFF intermittently returns 503 / HTML rate-limit pages; retry with backoff.
async function fetchOffPage(args: Args, page: number): Promise<OffSearchResponse> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(buildSearchUrl(page, args.pageSize), {
        headers: { 'User-Agent': OFF_USER_AGENT, Accept: 'application/json' },
      })
      if (res.ok) return (await res.json()) as OffSearchResponse
      lastErr = new Error(`status ${res.status}`)
    } catch (e) {
      lastErr = e
    }
    if (attempt < 4) await sleep(Math.min(2000 * 2 ** attempt, 30000))
  }
  throw new Error(`OFF page ${page} failed after 5 attempts: ${String(lastErr)}`)
}

async function seedFromOff(args: Args, push: Push): Promise<void> {
  console.log('seeding live from Open Food Facts (India)…')
  if (args.cacheOut) await mkdir(args.cacheOut, { recursive: true })
  for (let page = 1; ; page++) {
    const data = await fetchOffPage(args, page)
    const products = data.products ?? []
    if (products.length === 0) break

    const items = products.map(mapOffProduct)
    if (args.cacheOut) {
      await writeFile(join(args.cacheOut, `page-${page}.json`), JSON.stringify({ items, total: data.count ?? 0 }))
    }
    for (const item of items) {
      if (validBarcode(item.Barcode ?? '')) {
        if (!(await push(cacheItemToSeedItem(item)))) return
      }
    }
    await sleep(args.delay)
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const totals: BulkResponse = { inserted: 0, refreshed: 0, skipped: 0, invalid: 0 }
  let buffer: Record<string, unknown>[] = []
  let seen = 0

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

  const push: Push = async (item) => {
    buffer.push(item)
    seen++
    if (buffer.length >= args.batch) await flush()
    return !(args.limit > 0 && seen >= args.limit)
  }

  if (args.source === 'off') await seedFromOff(args, push)
  else await seedFromCache(args, push)
  await flush()

  console.log(
    `\ndone — inserted=${totals.inserted} refreshed=${totals.refreshed} skipped=${totals.skipped} invalid=${totals.invalid}`,
  )
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
