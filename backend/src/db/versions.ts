import { loadProduct } from './queries'
import { ulid } from '../lib/ulid'
import type { ResolvedProduct } from './schema'

export interface VersionMeta {
  id: string
  version: number
  note: string
  created_by: string
  created_at: string
}

/** Editable product state (full replacement). */
export interface ProductEdit {
  name: string
  description: string
  ingredients: string
  category: string
  food_type: string
  image_url: string
  hsn_code: string
  translations: { lang: string; name: string; description: string; ingredients: string }[]
}

/** Snapshot the product's current full state as a new version. Returns the new version (0 if the product is gone). */
export async function snapshotVersion(
  db: D1Database,
  productId: string,
  note: string,
  createdBy: string,
  now: string,
): Promise<number> {
  const full = await loadProduct(db, productId)
  if (!full) return 0
  const next = (
    await db
      .prepare('SELECT COALESCE(MAX(version), 0) + 1 AS n FROM product_versions WHERE product_id = ?')
      .bind(productId)
      .first<{ n: number }>()
  )!.n
  await db
    .prepare(
      'INSERT INTO product_versions (id, product_id, version, snapshot, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(ulid(), productId, next, JSON.stringify(full), note, createdBy, now)
    .run()
  return next
}

export async function listVersions(db: D1Database, productId: string): Promise<VersionMeta[]> {
  const rows = await db
    .prepare(
      'SELECT id, version, note, created_by, created_at FROM product_versions WHERE product_id = ? ORDER BY version DESC',
    )
    .bind(productId)
    .all<VersionMeta>()
  return rows.results
}

export async function countVersions(db: D1Database, productId: string): Promise<number> {
  return (
    await db
      .prepare('SELECT COUNT(*) AS c FROM product_versions WHERE product_id = ?')
      .bind(productId)
      .first<{ c: number }>()
  )!.c
}

/** Apply a full-replacement edit to a product's fields + translations. */
export async function applyProductEdit(
  db: D1Database,
  productId: string,
  edit: ProductEdit,
  now: string,
): Promise<void> {
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        'UPDATE products SET name=?, description=?, ingredients=?, category=?, food_type=?, image_url=?, hsn_code=?, updated_at=? WHERE id=?',
      )
      .bind(edit.name, edit.description, edit.ingredients, edit.category, edit.food_type, edit.image_url, edit.hsn_code, now, productId),
    db.prepare('DELETE FROM product_translations WHERE product_id = ?').bind(productId),
    ...edit.translations.map((t) =>
      db
        .prepare(
          'INSERT INTO product_translations (id, product_id, lang, name, description, ingredients, source, verified, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(ulid(), productId, t.lang, t.name, t.description, t.ingredients, 'crowd', 0, now),
    ),
  ]
  await db.batch(stmts)
}

/** Restore product/variants/translations from a version snapshot, then version the result. Returns false if the version is unknown. */
export async function revertToVersion(
  db: D1Database,
  productId: string,
  version: number,
  createdBy: string,
  now: string,
): Promise<boolean> {
  const row = await db
    .prepare('SELECT snapshot FROM product_versions WHERE product_id = ? AND version = ?')
    .bind(productId, version)
    .first<{ snapshot: string }>()
  if (!row) return false
  const state = JSON.parse(row.snapshot) as ResolvedProduct

  const p = state.product
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        'UPDATE products SET name=?, group_key=?, image_url=?, hsn_code=?, category=?, food_type=?, description=?, ingredients=?, updated_at=? WHERE id=?',
      )
      .bind(p.name, p.group_key, p.image_url, p.hsn_code, p.category, p.food_type, p.description, p.ingredients, now, productId),
    db.prepare('DELETE FROM variants WHERE product_id = ?').bind(productId),
    db.prepare('DELETE FROM product_translations WHERE product_id = ?').bind(productId),
    ...state.variants.map((v) =>
      db
        .prepare(
          'INSERT INTO variants (id, product_id, label, pack_size, unit, barcode, mrp_paise, source, moderation_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(v.id, productId, v.label, v.pack_size, v.unit, v.barcode, v.mrp_paise, v.source, v.moderation_status, v.created_at, now),
    ),
    ...state.translations.map((t) =>
      db
        .prepare(
          'INSERT INTO product_translations (id, product_id, lang, name, description, ingredients, source, verified, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(t.id, productId, t.lang, t.name, t.description, t.ingredients, t.source, t.verified, t.created_at),
    ),
  ]
  await db.batch(stmts)
  await snapshotVersion(db, productId, `revert to v${version}`, createdBy, now)
  return true
}
