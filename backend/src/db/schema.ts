// TypeScript row types mirroring migrations/0001_init.sql.

export interface BrandRow {
  id: string
  name: string
  slug: string
  manufacturer: string
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

export interface ProductNameRow {
  id: string
  product_id: string
  lang: string
  name: string
  source: string
  verified: number
  created_at: string
}

/** A product family with its sellable variants and multilingual names. */
export interface ResolvedProduct {
  product: ProductRow
  variants: VariantRow[]
  names: ProductNameRow[]
}
