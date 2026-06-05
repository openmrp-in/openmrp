import { sha256Hex } from '../lib/hex'
import { buildManifest, type FileEntry, type Manifest } from './manifest'
import { TABLES, buildSqlDump, toCsv, type DumpData, type Row } from './serialize'

export const SQL_FILE = 'openmrp.sql'
export const MANIFEST_FILE = 'manifest.json'

/** The set of downloadable object names → their content type (the public allow-list). */
export function dumpFiles(): Map<string, string> {
  const m = new Map<string, string>()
  for (const t of TABLES) {
    m.set(`${t.name}.json`, 'application/json')
    m.set(`${t.name}.csv`, 'text/csv')
  }
  m.set(SQL_FILE, 'application/sql')
  m.set(MANIFEST_FILE, 'application/json')
  return m
}

/** Read every exported table in full. */
export async function loadAllRows(db: D1Database): Promise<DumpData> {
  const data: DumpData = {}
  for (const t of TABLES) {
    const res = await db.prepare(`SELECT ${t.columns.join(', ')} FROM ${t.name}`).all<Row>()
    data[t.name] = res.results
  }
  return data
}

async function putFile(
  bucket: R2Bucket,
  path: string,
  body: string,
  contentType: string,
  format: FileEntry['format'],
  table: string,
  rows: number,
): Promise<FileEntry> {
  const bytes = new TextEncoder().encode(body)
  await bucket.put(path, bytes, { httpMetadata: { contentType } })
  return { path, format, table, rows, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) }
}

/** Build the full dump (json + csv per table, one combined SQL) into R2 and write the manifest. */
export async function runExport(db: D1Database, bucket: R2Bucket, now: string): Promise<Manifest> {
  const data = await loadAllRows(db)
  const files: FileEntry[] = []
  for (const t of TABLES) {
    const rows = data[t.name]
    files.push(await putFile(bucket, `${t.name}.json`, JSON.stringify(rows), 'application/json', 'json', t.name, rows.length))
    files.push(await putFile(bucket, `${t.name}.csv`, toCsv(t.columns, rows), 'text/csv', 'csv', t.name, rows.length))
  }
  files.push(await putFile(bucket, SQL_FILE, buildSqlDump(data), 'application/sql', 'sql', 'all', 0))
  const manifest = buildManifest(now, files)
  await bucket.put(MANIFEST_FILE, JSON.stringify(manifest, null, 2), { httpMetadata: { contentType: 'application/json' } })
  return manifest
}
