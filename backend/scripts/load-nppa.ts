/**
 * Load NPPA-published drug MRPs into OpenMRP. NPPA (National Pharmaceutical Pricing
 * Authority) publishes ceiling prices / MRPs for scheduled medicines as PUBLIC
 * GOVERNMENT DATA — a legitimate bulk source (unlike scraping a commercial site).
 *
 * Download the latest ceiling-price list from https://nppa.gov.in, save it as CSV
 * (a header row + columns for the formulation name, pack/unit, and price), then:
 *
 *   npm run load-nppa -- --file nppa.csv --url http://127.0.0.1:8787 --admin-key <key>
 *
 * Medicines carry no barcode, so each is keyed by a synthetic `nppa-…` id and is
 * name-searchable (answers "is my medicine overpriced?"). Prices are stamped
 * source='gov'. Idempotent: re-running upserts the same products + prices.
 */
import { readFile } from 'node:fs/promises'
import { parseNppaCsv, nppaKey } from '../src/lib/nppa'

interface Args {
  file: string
  url: string
  adminKey: string
  batch: number
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string, def: string): string => {
    const i = argv.indexOf(flag)
    return i >= 0 && argv[i + 1] ? argv[i + 1] : def
  }
  const file = get('--file', '')
  if (!file) throw new Error('usage: load-nppa --file <nppa.csv> [--url ...] [--admin-key ...]')
  return { file, url: get('--url', 'http://127.0.0.1:8787'), adminKey: get('--admin-key', 'local-dev-admin-key-change-me'), batch: Number(get('--batch', '200')) }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const headers = { 'X-Admin-Key': args.adminKey, 'content-type': 'application/json' }
  const rows = parseNppaCsv(await readFile(args.file, 'utf8'))
  console.log(`parsed ${rows.length} NPPA rows from ${args.file}`)

  // Bulk-upsert as approved, searchable, categorized products (medicines are keyed by
  // a synthetic nppa-… id), then set the authoritative MRP (source=gov).
  const seedItems = rows.map((r) => ({ barcode: nppaKey(r.name, r.pack), name: r.name, unit: r.pack, category: 'Medicine' }))
  const priceItems = rows.map((r) => ({ barcode: nppaKey(r.name, r.pack), mrp_paise: r.mrpPaise, source: 'gov' }))

  let upserted = 0
  let priced = 0
  for (let i = 0; i < seedItems.length; i += args.batch) {
    const seedRes = await fetch(`${args.url}/v1/products/bulk`, { method: 'POST', headers, body: JSON.stringify({ items: seedItems.slice(i, i + args.batch) }) })
    if (!seedRes.ok) throw new Error(`bulk failed: ${seedRes.status} ${await seedRes.text()}`)
    const s = (await seedRes.json()) as { inserted: number; refreshed: number }
    upserted += s.inserted + s.refreshed

    const priceRes = await fetch(`${args.url}/v1/admin/prices`, { method: 'POST', headers, body: JSON.stringify({ items: priceItems.slice(i, i + args.batch) }) })
    if (!priceRes.ok) throw new Error(`price set failed: ${priceRes.status} ${await priceRes.text()}`)
    priced += ((await priceRes.json()) as { set: number }).set
    process.stdout.write(`  ${priced}/${rows.length} priced\r`)
  }

  console.log(`\ndone — ${upserted} products upserted, ${priced}/${rows.length} priced (category=Medicine, source=gov)`)
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
