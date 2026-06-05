import { describe, it, expect } from 'vitest'
import { buildSqlDump, csvEscape, toCsv, toSqlInserts } from '../src/dump/serialize'
import { buildManifest } from '../src/dump/manifest'

describe('csv serialization', () => {
  it('escapes only when needed', () => {
    expect(csvEscape('plain')).toBe('plain')
    expect(csvEscape(null)).toBe('')
    expect(csvEscape(undefined)).toBe('')
    expect(csvEscape(42)).toBe('42')
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('he said "hi"')).toBe('"he said ""hi"""')
    expect(csvEscape('line\nbreak')).toBe('"line\nbreak"')
  })

  it('builds a header + rows with a trailing newline', () => {
    expect(toCsv(['a', 'b'], [{ a: '1', b: '2' }, { a: 'x,y', b: null }])).toBe('a,b\n1,2\n"x,y",\n')
  })

  it('emits a header-only file for an empty table', () => {
    expect(toCsv(['a', 'b'], [])).toBe('a,b\n')
  })
})

describe('sql serialization', () => {
  it('builds INSERTs, escaping quotes and rendering numbers/nulls', () => {
    expect(toSqlInserts('t', ['a', 'b', 'c'], [{ a: 'x', b: 5, c: null }])).toBe("INSERT INTO t (a, b, c) VALUES ('x', 5, NULL);\n")
    expect(toSqlInserts('t', ['a'], [{ a: "O'Brien" }])).toBe("INSERT INTO t (a) VALUES ('O''Brien');\n")
  })

  it('emits nothing for an empty table', () => {
    expect(toSqlInserts('t', ['a'], [])).toBe('')
  })

  it('dumps present tables and tolerates a missing one', () => {
    const sql = buildSqlDump({ brands: [{ id: 'b1', name: 'B' }] })
    expect(sql).toContain('-- OpenMRP open dataset')
    expect(sql).toContain("INSERT INTO brands (id, name, slug, manufacturer, description, source, moderation_status, created_at, updated_at) VALUES ('b1', 'B', NULL")
    expect(sql).not.toContain('INSERT INTO products') // missing table → no inserts
  })
})

describe('manifest', () => {
  it('counts JSON files for total_rows', () => {
    const m = buildManifest('2026-01-01T00:00:00.000Z', [
      { path: 'products.json', format: 'json', table: 'products', rows: 3, bytes: 10, sha256: 'x' },
      { path: 'products.csv', format: 'csv', table: 'products', rows: 3, bytes: 8, sha256: 'y' },
      { path: 'brands.json', format: 'json', table: 'brands', rows: 2, bytes: 5, sha256: 'z' },
    ])
    expect(m).toMatchObject({ name: 'OpenMRP open dataset', license: 'ODbL-1.0', generated_at: '2026-01-01T00:00:00.000Z', total_rows: 5 })
    expect(m.files).toHaveLength(3)
  })
})
