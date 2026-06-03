import { z } from '@hono/zod-openapi'

// ─── Shared / error ──────────────────────────────────────────────────────────
export const ErrorSchema = z
  .object({
    error: z.string(),
    detail: z.string().optional(),
    details: z.array(z.string()).optional(),
  })
  .openapi('Error')

export const HealthSchema = z
  .object({ status: z.string(), service: z.string() })
  .openapi('Health')

// ─── Response row schemas (mirror the DB rows) ───────────────────────────────
export const VariantSchema = z
  .object({
    id: z.string(),
    product_id: z.string(),
    label: z.string(),
    pack_size: z.number(),
    unit: z.string(),
    barcode: z.string(),
    mrp_paise: z.number(),
    source: z.string(),
    moderation_status: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .openapi('Variant')

export const ProductSchema = z
  .object({
    id: z.string(),
    brand_id: z.string().nullable(),
    name: z.string(),
    group_key: z.string(),
    image_url: z.string(),
    hsn_code: z.string(),
    category: z.string(),
    food_type: z.string(),
    description: z.string(),
    ingredients: z.string(),
    source: z.string(),
    moderation_status: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .openapi('Product')

export const BrandSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    manufacturer: z.string(),
    description: z.string(),
    source: z.string(),
    moderation_status: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .openapi('Brand')

export const ProductTranslationSchema = z
  .object({
    id: z.string(),
    product_id: z.string(),
    lang: z.string(),
    name: z.string(),
    description: z.string(),
    ingredients: z.string(),
    source: z.string(),
    verified: z.number(),
    created_at: z.string(),
  })
  .openapi('ProductTranslation')

export const BrandTranslationSchema = z
  .object({
    id: z.string(),
    brand_id: z.string(),
    lang: z.string(),
    name: z.string(),
    description: z.string(),
    source: z.string(),
    verified: z.number(),
    created_at: z.string(),
  })
  .openapi('BrandTranslation')

export const OffSuggestionSchema = z
  .object({
    barcode: z.string(),
    name: z.string(),
    brand: z.string(),
    image_url: z.string(),
    quantity: z.string(),
  })
  .openapi('OffSuggestion')

export const ResolveResultSchema = z
  .object({
    found: z.boolean(),
    source: z.enum(['crowd', 'off', 'none']),
    product: ProductSchema.optional(),
    brand: BrandSchema.nullable().optional(),
    variants: z.array(VariantSchema).optional(),
    translations: z.array(ProductTranslationSchema).optional(),
    brand_translations: z.array(BrandTranslationSchema).optional(),
    off_suggestion: OffSuggestionSchema.optional(),
  })
  .openapi('ResolveResult')

export const ProductCardSchema = z
  .object({
    barcode: z.string(),
    name: z.string(),
    brand: z.string(),
    food_type: z.string(),
    mrp_paise: z.number(),
  })
  .openapi('ProductCard')

export const BrandSummarySchema = z
  .object({ slug: z.string(), name: z.string(), product_count: z.number() })
  .openapi('BrandSummary')

export const SearchResponseSchema = z
  .object({ query: z.string(), results: z.array(ProductCardSchema) })
  .openapi('SearchResponse')

export const BrandsResponseSchema = z
  .object({ brands: z.array(BrandSummarySchema) })
  .openapi('BrandsResponse')

export const BrandProductsResponseSchema = z
  .object({ slug: z.string(), results: z.array(ProductCardSchema) })
  .openapi('BrandProductsResponse')

export const CreatedResponseSchema = z
  .object({
    created: z.boolean(),
    product: ProductSchema,
    brand: BrandSchema.nullable(),
    variants: z.array(VariantSchema),
    translations: z.array(ProductTranslationSchema),
    brand_translations: z.array(BrandTranslationSchema),
  })
  .openapi('CreatedResponse')

export const BulkResponseSchema = z
  .object({
    ok: z.boolean(),
    inserted: z.number(),
    refreshed: z.number(),
    skipped: z.number(),
    invalid: z.number(),
  })
  .openapi('BulkResponse')

// ─── Request schemas (the validators — the OpenAPI request bodies) ───────────
export const ProductTranslationInputSchema = z
  .object({
    lang: z.string().min(1),
    name: z.string().default(''),
    description: z.string().default(''),
    ingredients: z.string().default(''),
  })
  .openapi('ProductTranslationInput')

export const BrandTranslationInputSchema = z
  .object({
    lang: z.string().min(1),
    name: z.string().default(''),
    description: z.string().default(''),
  })
  .openapi('BrandTranslationInput')

export const VariantInputSchema = z
  .object({
    label: z.string().optional(),
    pack_size: z.number().optional(),
    unit: z.string().optional(),
    barcode: z.string().optional(),
    mrp_paise: z.number().int().nonnegative().optional(),
  })
  .openapi('VariantInput')

export const CreateProductSchema = z
  .object({
    brand: z
      .object({
        name: z.string().min(1),
        slug: z.string().optional(),
        manufacturer: z.string().optional(),
        description: z.string().default(''),
        translations: z.array(BrandTranslationInputSchema).default([]),
      })
      .optional(),
    product: z.object({
      name: z.string().min(1),
      group_key: z.string().optional(),
      image_url: z.string().optional(),
      hsn_code: z.string().optional(),
      category: z.string().optional(),
      food_type: z.enum(['veg', 'non-veg', 'egg', 'none']).default('none'),
      description: z.string().default(''),
      ingredients: z.string().default(''),
    }),
    variants: z.array(VariantInputSchema).min(1),
    translations: z.array(ProductTranslationInputSchema).default([]),
  })
  .openapi('CreateProduct')

/** Loose seed item — only barcode+name are meaningful; the handler counts invalid rows. */
export const SeedItemSchema = z
  .object({
    barcode: z.string().optional(),
    name: z.string().optional(),
    brand: z.string().optional(),
    pack_size: z.number().optional(),
    unit: z.string().optional(),
    food_type: z.string().optional(),
    group_key: z.string().optional(),
  })
  .openapi('SeedItem')

export const BulkRequestSchema = z
  .object({ items: z.array(SeedItemSchema).min(1) })
  .openapi('BulkRequest')

/** The normalized create-product input (Zod output) — the store's input type. */
export type CreateProductInput = z.infer<typeof CreateProductSchema>
