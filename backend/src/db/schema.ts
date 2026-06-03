// TypeScript row types mirroring the migrations.

export interface BrandRow {
  id: string
  name: string
  slug: string
  manufacturer: string
  description: string
  source: string
  moderation_status: string
  created_at: string
  updated_at: string
}

export interface ProductRow {
  id: string
  brand_id: string | null
  name: string
  group_key: string
  image_url: string
  hsn_code: string
  category: string
  food_type: string
  description: string
  ingredients: string
  source: string
  moderation_status: string
  created_at: string
  updated_at: string
}

export interface VariantRow {
  id: string
  product_id: string
  label: string
  pack_size: number
  unit: string
  barcode: string
  mrp_paise: number
  source: string
  moderation_status: string
  created_at: string
  updated_at: string
}

/** Per-language product text (name + description + ingredients). */
export interface ProductTranslationRow {
  id: string
  product_id: string
  lang: string
  name: string
  description: string
  ingredients: string
  source: string
  verified: number
  created_at: string
}

/** Per-language brand text (name + description). */
export interface BrandTranslationRow {
  id: string
  brand_id: string
  lang: string
  name: string
  description: string
  source: string
  verified: number
  created_at: string
}

/** A product family with its brand, sellable variants and per-language text. */
export interface ResolvedProduct {
  product: ProductRow
  brand: BrandRow | null
  variants: VariantRow[]
  translations: ProductTranslationRow[]
  brand_translations: BrandTranslationRow[]
}
