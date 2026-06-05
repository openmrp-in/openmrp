// Pure serializers for the open data dump (JSON/CSV/SQL). The table+column lists
// are explicit so output is deterministic regardless of row contents (incl. empty
// tables). These functions take plain rows and never touch the DB or R2.

export interface TableSpec {
  name: string
  columns: string[]
}

export const TABLES: TableSpec[] = [
  { name: 'brands', columns: ['id', 'name', 'slug', 'manufacturer', 'description', 'source', 'moderation_status', 'created_at', 'updated_at'] },
  { name: 'products', columns: ['id', 'brand_id', 'name', 'group_key', 'image_url', 'hsn_code', 'category', 'food_type', 'description', 'ingredients', 'source', 'moderation_status', 'created_at', 'updated_at'] },
  { name: 'variants', columns: ['id', 'product_id', 'label', 'pack_size', 'unit', 'barcode', 'mrp_paise', 'source', 'moderation_status', 'created_at', 'updated_at'] },
  { name: 'product_translations', columns: ['id', 'product_id', 'lang', 'name', 'description', 'ingredients', 'source', 'verified', 'created_at'] },
  { name: 'brand_translations', columns: ['id', 'brand_id', 'lang', 'name', 'description', 'source', 'verified', 'created_at'] },
]

export type Row = Record<string, unknown>
/** All exported rows, keyed by table name. */
export type DumpData = Record<string, Row[]>

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** RFC-4180 CSV with a header row. Always ends with a trailing newline. */
export function toCsv(columns: string[], rows: Row[]): string {
  const head = columns.map(csvEscape).join(',')
  if (rows.length === 0) return `${head}\n`
  const body = rows.map((r) => columns.map((c) => csvEscape(r[c])).join(',')).join('\n')
  return `${head}\n${body}\n`
}

function sqlValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') return String(value)
  return `'${String(value).replace(/'/g, "''")}'`
}

/** INSERT statements for one table (empty string for an empty table). */
export function toSqlInserts(table: string, columns: string[], rows: Row[]): string {
  if (rows.length === 0) return ''
  const cols = columns.join(', ')
  return (
    rows.map((r) => `INSERT INTO ${table} (${cols}) VALUES (${columns.map((c) => sqlValue(r[c])).join(', ')});`).join('\n') + '\n'
  )
}

/** A portable SQL dump: `sqlite3 openmrp.db < openmrp.sql` (schema comes from migrations). */
export function buildSqlDump(data: DumpData): string {
  let out = '-- OpenMRP open dataset — data only (ODbL-1.0). Load schema from migrations first.\n'
  for (const spec of TABLES) out += toSqlInserts(spec.name, spec.columns, data[spec.name] ?? [])
  return out
}
