import { paiseFromRupees } from './prices'

// Parse a brand catalog CSV (header row + barcode/name/MRP/pack/category/food_type
// columns, header-flexible) into the items the brand-catalog upload API expects.
export interface CatalogRow {
  barcode: string
  name: string
  mrp_paise?: number
  pack: string
  category: string
  food_type: string
}

export function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let field = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') { field += '"'; i++ } else q = false
      } else field += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { out.push(field); field = '' }
    else field += ch
  }
  out.push(field)
  return out
}

export function parseCatalogCsv(text: string): CatalogRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().trim())
  const find = (re: RegExp): number => header.findIndex((h) => re.test(h))
  const bi = find(/barcode|gtin|ean/)
  const ni = find(/name|product/)
  const mi = find(/mrp|price|\brs\b/)
  const pi = find(/pack|size|unit|label/)
  const ci = find(/category|cat/)
  const fi = find(/food|veg/)
  if (bi < 0 || ni < 0) throw new Error('CSV needs a barcode column and a name column')

  const col = (c: string[], i: number): string => (i >= 0 ? (c[i] ?? '').trim() : '')
  const rows: CatalogRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const c = splitCsvLine(lines[i])
    const barcode = col(c, bi)
    const name = col(c, ni)
    if (barcode === '' && name === '') continue
    const mrp = mi >= 0 ? paiseFromRupees(col(c, mi)) : null
    rows.push({ barcode, name, ...(mrp !== null ? { mrp_paise: mrp } : {}), pack: col(c, pi), category: col(c, ci), food_type: col(c, fi) })
  }
  return rows
}
