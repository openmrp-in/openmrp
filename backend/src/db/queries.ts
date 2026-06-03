import type { SeedItem } from '../lib/seed'
import type { CreateProductInput } from '../openapi/schemas'
import { slugify } from '../lib/slug'
import { ulid } from '../lib/ulid'
import type {
  BrandRow,
  BrandTranslationRow,
  ProductRow,
  ProductTranslationRow,
  ResolvedProduct,
  VariantRow,
} from './schema'

/** Outcome counts from a bulk upsert (seeding). */
export interface BulkResult {
  inserted: number
  refreshed: number
  skipped: number
}

/** A compact product result for search / browse listings. */
export interface ProductCard {
  barcode: string
  name: string
  brand: string
  food_type: string
  mrp_paise: number
}

/** A brand with its approved-product count, for the browse index. */
export interface BrandSummary {
  slug: string
  name: string
  product_count: number
}

/**
 * The persistence surface the rest of the app depends on. Defined as an interface
 * so the resolve chain + routes can be unit-tested with an in-memory fake
 * (no D1 / no Workers runtime needed).
 */
export interface ProductStore {
  /** Resolve a barcode to its full product family, or null if unknown. */
  findByBarcode(barcode: string): Promise<ResolvedProduct | null>
  /** Create a product (+ optional brand, variants, names). Used by admin seed. */
  createProduct(input: CreateProductInput): Promise<ResolvedProduct>
  /**
   * Bulk-upsert normalized seed items. Idempotent by barcode: a new barcode is
   * inserted; an existing `source='off'` row is refreshed; a shop-improved row
   * (any other source) is skipped.
   */
  bulkUpsert(items: SeedItem[]): Promise<BulkResult>
  /** Search approved products by name (substring, case-insensitive). */
  searchProducts(query: string, limit: number): Promise<ProductCard[]>
  /** List approved brands that have at least one approved product, busiest first. */
  listBrands(limit: number): Promise<BrandSummary[]>
  /** Approved products for a brand slug. */
  productsByBrand(slug: string, limit: number): Promise<ProductCard[]>
}

// Shared SELECT for a ProductCard: representative barcode + lowest known MRP.
const CARD_SELECT = `
  SELECT
    COALESCE((SELECT v.barcode FROM variants v WHERE v.product_id = p.id AND v.barcode <> '' LIMIT 1), '') AS barcode,
    p.name AS name,
    COALESCE(b.name, '') AS brand,
    p.food_type AS food_type,
    COALESCE((SELECT MIN(v.mrp_paise) FROM variants v WHERE v.product_id = p.id AND v.mrp_paise > 0), 0) AS mrp_paise
  FROM products p
  LEFT JOIN brands b ON b.id = p.brand_id
  WHERE p.moderation_status = 'approved'
    AND EXISTS (SELECT 1 FROM variants v WHERE v.product_id = p.id AND v.barcode <> '')`

/** Load a product's full state (product + brand + variants + translations) by id. */
export async function loadProduct(db: D1Database, productId: string): Promise<ResolvedProduct | null> {
  const product = await db.prepare('SELECT * FROM products WHERE id = ?').bind(productId).first<ProductRow>()
  if (!product) return null

  const brand: BrandRow | null = product.brand_id
    ? await db.prepare('SELECT * FROM brands WHERE id = ?').bind(product.brand_id).first<BrandRow>()
    : null

  const variants = await db
    .prepare('SELECT * FROM variants WHERE product_id = ? ORDER BY pack_size')
    .bind(productId)
    .all<VariantRow>()
  const translations = await db
    .prepare('SELECT * FROM product_translations WHERE product_id = ?')
    .bind(productId)
    .all<ProductTranslationRow>()
  const brandTranslations = brand
    ? (await db.prepare('SELECT * FROM brand_translations WHERE brand_id = ?').bind(brand.id).all<BrandTranslationRow>()).results
    : []

  return {
    product,
    brand,
    variants: variants.results,
    translations: translations.results,
    brand_translations: brandTranslations,
  }
}

/** D1-backed implementation of ProductStore. */
export function createD1Store(db: D1Database): ProductStore {
  const loadById = (productId: string) => loadProduct(db, productId)

  return {
    async findByBarcode(barcode: string): Promise<ResolvedProduct | null> {
      const row = await db
        .prepare('SELECT product_id FROM variants WHERE barcode = ? LIMIT 1')
        .bind(barcode)
        .first<{ product_id: string }>()
      if (!row) return null
      return loadById(row.product_id)
    },

    async createProduct(input: CreateProductInput): Promise<ResolvedProduct> {
      const now = new Date().toISOString()
      const stmts: D1PreparedStatement[] = []

      // Resolve or create the brand (+ its per-language translations). A *new* brand
      // is inserted as part of the same batch below, so the whole create is one atomic
      // transaction — no orphan brand if a later insert fails.
      let brandId: string | null = null
      if (input.brand) {
        const slug = slugify(input.brand.slug || input.brand.name)
        const existing = await db
          .prepare('SELECT id FROM brands WHERE slug = ?')
          .bind(slug)
          .first<{ id: string }>()
        if (existing) {
          brandId = existing.id
        } else {
          brandId = ulid()
          stmts.push(
            db
              .prepare(
                'INSERT INTO brands (id, name, slug, manufacturer, description, source, moderation_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              )
              .bind(
                brandId,
                input.brand.name,
                slug,
                input.brand.manufacturer ?? '',
                input.brand.description,
                'crowd',
                'approved',
                now,
                now,
              ),
          )
        }
        for (const t of input.brand.translations) {
          stmts.push(
            db
              .prepare(
                'INSERT INTO brand_translations (id, brand_id, lang, name, description, source, verified, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(brand_id, lang) DO UPDATE SET name = excluded.name, description = excluded.description',
              )
              .bind(ulid(), brandId, t.lang, t.name, t.description, 'crowd', 0, now),
          )
        }
      }

      const productId = ulid()
      const groupKey = slugify(input.product.group_key || input.product.name)

      stmts.push(
        db
          .prepare(
            'INSERT INTO products (id, brand_id, name, group_key, image_url, hsn_code, category, food_type, description, ingredients, source, moderation_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .bind(
            productId,
            brandId,
            input.product.name,
            groupKey,
            input.product.image_url ?? '',
            input.product.hsn_code ?? '',
            input.product.category ?? '',
            input.product.food_type,
            input.product.description,
            input.product.ingredients,
            'crowd',
            'pending',
            now,
            now,
          ),
      )

      for (const v of input.variants) {
        stmts.push(
          db
            .prepare(
              'INSERT INTO variants (id, product_id, label, pack_size, unit, barcode, mrp_paise, source, moderation_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            )
            .bind(
              ulid(),
              productId,
              v.label ?? '',
              v.pack_size ?? 0,
              v.unit ?? '',
              v.barcode ?? '',
              v.mrp_paise ?? 0,
              'crowd',
              'pending',
              now,
              now,
            ),
        )
      }

      for (const t of input.translations) {
        stmts.push(
          db
            .prepare(
              'INSERT INTO product_translations (id, product_id, lang, name, description, ingredients, source, verified, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            )
            .bind(ulid(), productId, t.lang, t.name, t.description, t.ingredients, 'crowd', 0, now),
        )
      }

      await db.batch(stmts)

      const created = await loadById(productId)
      /* istanbul ignore if -- @preserve: defensive; the rows were just inserted in the batch above */
      if (!created) throw new Error('failed to load created product')
      return created
    },

    async bulkUpsert(items: SeedItem[]): Promise<BulkResult> {
      const now = new Date().toISOString()
      const brandCache = new Map<string, string>()
      const result: BulkResult = { inserted: 0, refreshed: 0, skipped: 0 }

      for (const item of items) {
        const existing = await db
          .prepare('SELECT id, source FROM variants WHERE barcode = ?')
          .bind(item.barcode)
          .first<{ id: string; source: string }>()
        if (existing) {
          if (existing.source === 'off') {
            await db
              .prepare('UPDATE variants SET pack_size = ?, unit = ?, updated_at = ? WHERE id = ?')
              .bind(item.pack_size, item.unit, now, existing.id)
              .run()
            result.refreshed++
          } else {
            result.skipped++
          }
          continue
        }

        let brandId: string | null = null
        if (item.brand) {
          const slug = slugify(item.brand)
          const cached = brandCache.get(slug)
          if (cached) {
            brandId = cached
          } else {
            const row = await db
              .prepare(
                'INSERT INTO brands (id, name, slug, manufacturer, source, moderation_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(slug) DO UPDATE SET updated_at = excluded.updated_at RETURNING id',
              )
              .bind(ulid(), item.brand, slug, '', 'off', 'approved', now, now)
              .first<{ id: string }>()
            brandId = row!.id
            brandCache.set(slug, brandId)
          }
        }

        const productId = ulid()
        await db.batch([
          db
            .prepare(
              'INSERT INTO products (id, brand_id, name, group_key, image_url, hsn_code, category, food_type, source, moderation_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            )
            .bind(productId, brandId, item.name, slugify(item.group_key), '', '', '', item.food_type, 'off', 'approved', now, now),
          db
            .prepare(
              'INSERT INTO variants (id, product_id, label, pack_size, unit, barcode, mrp_paise, source, moderation_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            )
            .bind(ulid(), productId, '', item.pack_size, item.unit, item.barcode, 0, 'off', 'approved', now, now),
        ])
        result.inserted++
      }
      return result
    },

    async searchProducts(query: string, limit: number): Promise<ProductCard[]> {
      const rows = await db
        .prepare(`${CARD_SELECT} AND LOWER(p.name) LIKE '%' || LOWER(?) || '%' ORDER BY p.name LIMIT ?`)
        .bind(query, limit)
        .all<ProductCard>()
      return rows.results
    },

    async listBrands(limit: number): Promise<BrandSummary[]> {
      const rows = await db
        .prepare(
          `SELECT b.slug AS slug, b.name AS name, COUNT(p.id) AS product_count
           FROM brands b
           JOIN products p ON p.brand_id = b.id AND p.moderation_status = 'approved'
           WHERE b.moderation_status = 'approved'
           GROUP BY b.id
           ORDER BY product_count DESC, b.name
           LIMIT ?`,
        )
        .bind(limit)
        .all<BrandSummary>()
      return rows.results
    },

    async productsByBrand(slug: string, limit: number): Promise<ProductCard[]> {
      const rows = await db
        .prepare(`${CARD_SELECT} AND b.slug = ? ORDER BY p.name LIMIT ?`)
        .bind(slug, limit)
        .all<ProductCard>()
      return rows.results
    },
  }
}
