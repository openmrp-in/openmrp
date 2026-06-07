// Parser for NPPA (National Pharmaceutical Pricing Authority) published ceiling-price
// lists. NPPA publishes drug MRPs as public government data, so this is a legitimate
// bulk source. Save the published list as CSV; the loader (scripts/load-nppa.ts) feeds
// it through here. Medicines carry no barcode, so each is keyed by a synthetic `nppa-…`
// id and is name-searchable.

export interface NppaRow {
  name: string
  pack: string
  mrpPaise: number
}

export function slugifyName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

/** Stable synthetic key for a barcode-less medicine. */
export const nppaKey = (name: string, pack: string): string => `nppa-${slugifyName(`${name} ${pack}`)}`

/** Parse a rupee price ("₹12.50", "1,234") to integer paise; null if invalid/non-positive. */
export function parsePaise(s: string): number | null {
  const cleaned = s.replace(/[₹,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const paise = Math.round(parseFloat(cleaned) * 100)
  return paise > 0 ? paise : null
}

/** Split one CSV line, honouring "quoted, fields" with "" escapes. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { out.push(field); field = '' }
    else field += ch
  }
  out.push(field)
  return out
}

/**
 * Parse an NPPA CSV into normalized rows. Header-flexible: finds the name column
 * (formulation/medicine/drug/name), an optional pack column (unit/pack), and the
 * price column (mrp/ceiling/price). Rows without a name or a valid price are skipped.
 */
export function parseNppaCsv(text: string): NppaRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2) return []
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().trim())
  const nameIdx = header.findIndex((h) => /formulation|medicine|drug|name/.test(h))
  const priceIdx = header.findIndex((h) => /mrp|ceiling|price/.test(h))
  const packIdx = header.findIndex((h) => /unit|pack/.test(h))
  if (nameIdx < 0 || priceIdx < 0) throw new Error('NPPA CSV: need a name column and a price/MRP column')

  const out: NppaRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i])
    const name = (cols[nameIdx] ?? '').trim()
    const mrpPaise = parsePaise(cols[priceIdx] ?? '')
    if (name === '' || mrpPaise === null) continue
    out.push({ name, pack: packIdx >= 0 ? (cols[packIdx] ?? '').trim() : '', mrpPaise })
  }
  return out
}
