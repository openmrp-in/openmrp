import { ulid } from '../lib/ulid'
import { slugify } from '../lib/slug'
import { clampFoodType } from '../lib/seed'

// A verified brand owner uploads their own catalog. Because they own the brand, rows
// apply authoritatively: products are created/updated as approved under the brand, and
// MRP is set with source='brand'. Per-row errors are collected, not fatal to the batch.
// Matches the zod-resolved upload item (string fields are defaulted by the schema).
export interface CatalogItem {
  barcode: string
  name: string
  mrp_paise?: number
  pack: string
  category: string
  food_type: string
}

export interface CatalogSummary {
  created: number
  updated: number
  priced: number
  errors: { barcode: string; error: string }[]
}

export function createBrandCatalogStore(db: D1Database) {
  return {
    findBrandBySlug(slug: string): Promise<{ id: string; name: string } | null> {
      return db.prepare('SELECT id, name FROM brands WHERE slug = ?').bind(slug).first<{ id: string; name: string }>()
    },

    async ownsBrand(accountId: string, brandId: string): Promise<boolean> {
      const row = await db
        .prepare("SELECT 1 AS x FROM brand_owners WHERE account_id = ? AND brand_id = ? AND status = 'verified'")
        .bind(accountId, brandId)
        .first<{ x: number }>()
      return row !== null
    },

    async upsert(brandId: string, accountId: string, items: CatalogItem[], now: string): Promise<CatalogSummary> {
      const out: CatalogSummary = { created: 0, updated: 0, priced: 0, errors: [] }
      for (const raw of items) {
        const barcode = raw.barcode.trim()
        const name = raw.name.trim()
        if (barcode === '' || name === '') {
          out.errors.push({ barcode, error: 'barcode and name are required' })
          continue
        }
        const category = raw.category.trim()
        const label = raw.pack.trim()
        const foodType = clampFoodType(raw.food_type)

        const existing = await db.prepare('SELECT id, product_id FROM variants WHERE barcode = ?').bind(barcode).first<{ id: string; product_id: string }>()
        let variantId: string
        if (existing) {
          variantId = existing.id
          await db
            .prepare("UPDATE products SET brand_id=?, name=?, category=?, food_type=?, source='brand', moderation_status='approved', updated_at=? WHERE id=?")
            .bind(brandId, name, category, foodType, now, existing.product_id)
            .run()
          await db.prepare("UPDATE variants SET label=?, source='brand', moderation_status='approved', updated_at=? WHERE id=?").bind(label, now, variantId).run()
          out.updated++
        } else {
          const productId = ulid()
          variantId = ulid()
          await db
            .prepare(
              "INSERT INTO products (id, brand_id, name, group_key, image_url, hsn_code, category, food_type, description, ingredients, source, moderation_status, created_at, updated_at) VALUES (?, ?, ?, ?, '', '', ?, ?, '', '', 'brand', 'approved', ?, ?)",
            )
            .bind(productId, brandId, name, slugify(name), category, foodType, now, now)
            .run()
          await db
            .prepare("INSERT INTO variants (id, product_id, label, pack_size, unit, barcode, mrp_paise, source, moderation_status, created_at, updated_at) VALUES (?, ?, ?, 0, '', ?, 0, 'brand', 'approved', ?, ?)")
            .bind(variantId, productId, label, barcode, now, now)
            .run()
          out.created++
        }

        if (typeof raw.mrp_paise === 'number' && raw.mrp_paise > 0) {
          await db
            .prepare("UPDATE variants SET mrp_paise=?, mrp_source='brand', mrp_reported_by=?, mrp_updated_at=?, updated_at=? WHERE id=?")
            .bind(raw.mrp_paise, accountId, now, now, variantId)
            .run()
          out.priced++
        }
      }
      return out
    },
  }
}
