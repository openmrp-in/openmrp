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
    mrp_source: z.string(),
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
    category: z.string().optional(),
  })
  .openapi('SeedItem')

export const BulkRequestSchema = z
  .object({ items: z.array(SeedItemSchema).min(1) })
  .openapi('BulkRequest')

/** The normalized create-product input (Zod output) — the store's input type. */
export type CreateProductInput = z.infer<typeof CreateProductSchema>

// ─── Developer accounts ──────────────────────────────────────────────────────
export const RegisterSchema = z
  .object({
    email: z.string().trim().min(3).max(255).openapi({ example: 'dev@example.com' }),
    password: z.string().min(8).max(200),
    name: z.string().default(''),
  })
  .openapi('Register')

export const LoginSchema = z
  .object({ email: z.string().trim().min(3), password: z.string().min(1) })
  .openapi('Login')

export const DeveloperViewSchema = z
  .object({ id: z.string(), email: z.string(), name: z.string(), created_at: z.string() })
  .openapi('Developer')

export const AuthResponseSchema = z
  .object({ token: z.string(), developer: DeveloperViewSchema })
  .openapi('AuthResponse')

// ─── API keys ────────────────────────────────────────────────────────────────
export const CreateKeySchema = z.object({ name: z.string().default('') }).openapi('CreateKey')

export const ApiKeyViewSchema = z
  .object({
    id: z.string(),
    prefix: z.string(),
    name: z.string(),
    revoked: z.boolean(),
    request_count: z.number(),
    last_used_at: z.string(),
    created_at: z.string(),
  })
  .openapi('ApiKey')

export const CreatedKeySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    prefix: z.string(),
    /** Full plaintext key — shown once, store it now. */
    key: z.string(),
    created_at: z.string(),
  })
  .openapi('CreatedKey')

export const KeysListSchema = z.object({ keys: z.array(ApiKeyViewSchema) }).openapi('KeysList')

export const RevokeResponseSchema = z.object({ revoked: z.boolean() }).openapi('RevokeResponse')

// ─── Super-admin ─────────────────────────────────────────────────────────────
export const AdminDeveloperSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    key_count: z.number(),
    created_at: z.string(),
  })
  .openapi('AdminDeveloper')

export const AdminDevelopersSchema = z
  .object({ developers: z.array(AdminDeveloperSchema) })
  .openapi('AdminDevelopers')

export const AdminKeySchema = z
  .object({
    id: z.string(),
    developer_id: z.string(),
    prefix: z.string(),
    name: z.string(),
    revoked: z.boolean(),
    request_count: z.number(),
    last_used_at: z.string(),
    created_at: z.string(),
  })
  .openapi('AdminKey')

export const AdminKeysSchema = z.object({ keys: z.array(AdminKeySchema) }).openapi('AdminKeys')

// ─── Editing + versioning ────────────────────────────────────────────────────
export const EditProductSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().default(''),
    ingredients: z.string().default(''),
    category: z.string().default(''),
    food_type: z.enum(['veg', 'non-veg', 'egg', 'none']).default('none'),
    image_url: z.string().default(''),
    hsn_code: z.string().default(''),
    translations: z.array(ProductTranslationInputSchema).default([]),
  })
  .openapi('EditProduct')

export const ProductStateSchema = z
  .object({
    product: ProductSchema,
    brand: BrandSchema.nullable(),
    variants: z.array(VariantSchema),
    translations: z.array(ProductTranslationSchema),
    brand_translations: z.array(BrandTranslationSchema),
  })
  .openapi('ProductState')

export const VersionMetaSchema = z
  .object({
    id: z.string(),
    version: z.number(),
    note: z.string(),
    created_by: z.string(),
    created_at: z.string(),
  })
  .openapi('VersionMeta')

export const VersionsListSchema = z.object({ versions: z.array(VersionMetaSchema) }).openapi('VersionsList')
export const RevertSchema = z.object({ version: z.number().int().positive() }).openapi('Revert')
export const RevertedSchema = z.object({ reverted: z.boolean(), version: z.number() }).openapi('Reverted')

// ─── Roles + brand ownership ──────────────────────────────────────────────────
export const RoleEnum = z.enum(['contributor', 'brand_owner', 'admin'])

export const OwnedBrandSchema = z
  .object({ brand_id: z.string(), slug: z.string(), name: z.string(), status: z.string(), method: z.string(), created_at: z.string() })
  .openapi('OwnedBrand')

/** /v1/auth/me — the account plus its roles + verified brand ownership. */
export const MeSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    created_at: z.string(),
    roles: z.array(RoleEnum),
    owned_brands: z.array(OwnedBrandSchema),
  })
  .openapi('Me')

export const GrantRoleSchema = z.object({ role: RoleEnum }).openapi('GrantRole')
export const RolesListSchema = z.object({ roles: z.array(RoleEnum) }).openapi('RolesList')
export const GrantBrandOwnerSchema = z
  .object({ account_id: z.string().min(1), brand_id: z.string().min(1), method: z.string().default('admin') })
  .openapi('GrantBrandOwner')
export const OkSchema = z.object({ ok: z.boolean() }).openapi('Ok')

// ─── Contributions (community edits) ──────────────────────────────────────────
export const SubmitContributionSchema = z
  .object({ barcode: z.string().min(1), edit: EditProductSchema, note: z.string().default('') })
  .openapi('SubmitContribution')

export const ContributionSchema = z
  .object({
    id: z.string(),
    account_id: z.string(),
    product_id: z.string(),
    kind: z.string(),
    note: z.string(),
    status: z.string(),
    applied_version: z.number().nullable(),
    approvals: z.number(),
    created_at: z.string(),
    resolved_at: z.string(),
  })
  .openapi('Contribution')

export const ContributionsListSchema = z
  .object({ contributions: z.array(ContributionSchema) })
  .openapi('ContributionsList')

export const SubmitResultSchema = z
  .object({
    status: z.enum(['applied', 'pending']),
    contribution_id: z.string(),
    version: z.number().optional(),
  })
  .openapi('SubmitResult')

export const ApproveResultSchema = z
  .object({ status: z.enum(['applied', 'pending']), approvals: z.number(), version: z.number().optional() })
  .openapi('ApproveResult')

// ─── Brand-ownership claims (GEPIR-verified) ─────────────────────────────────
export const SubmitClaimSchema = z
  .object({
    slug: z.string().min(1).openapi({ description: 'Brand slug to claim' }),
    gtin: z.string().min(8).openapi({ description: 'A GTIN/barcode of a product under this brand' }),
    company: z.string().default('').openapi({ description: 'Your registered company name (matched against GEPIR)' }),
  })
  .openapi('SubmitClaim')

export const BrandClaimSchema = z
  .object({
    id: z.string(),
    account_id: z.string(),
    brand_id: z.string(),
    gtin: z.string(),
    claimed_company: z.string(),
    gepir_company: z.string(),
    status: z.string(),
    method: z.string(),
    resolved_at: z.string(),
    created_at: z.string(),
  })
  .openapi('BrandClaim')

export const BrandClaimsListSchema = z.object({ claims: z.array(BrandClaimSchema) }).openapi('BrandClaimsList')

export const SubmitClaimResultSchema = z
  .object({ status: z.enum(['verified', 'pending']), claim_id: z.string(), gepir_company: z.string() })
  .openapi('SubmitClaimResult')

// ─── Open data dump ──────────────────────────────────────────────────────────
export const DumpFileSchema = z
  .object({
    path: z.string(),
    format: z.string(),
    table: z.string(),
    rows: z.number(),
    bytes: z.number(),
    sha256: z.string(),
  })
  .openapi('DumpFile')

export const DumpManifestSchema = z
  .object({
    name: z.string(),
    license: z.string(),
    generated_at: z.string(),
    total_rows: z.number(),
    files: z.array(DumpFileSchema),
  })
  .openapi('DumpManifest')

// ─── MRP price reports ───────────────────────────────────────────────────────
export const SubmitPriceSchema = z
  .object({
    barcode: z.string().min(1),
    mrp_paise: z.number().int().positive().openapi({ description: 'MRP in paise (₹45.00 = 4500)' }),
    source: z.enum(['pack', 'brand', 'other']).default('pack').openapi({ description: 'Where you read it — report it FROM THE PACK, never scraped' }),
    note: z.string().default(''),
  })
  .openapi('SubmitPrice')

export const PriceReportSchema = z
  .object({
    id: z.string(),
    variant_id: z.string(),
    account_id: z.string(),
    mrp_paise: z.number(),
    source: z.string(),
    note: z.string(),
    status: z.string(),
    approvals: z.number(),
    created_at: z.string(),
    resolved_at: z.string(),
  })
  .openapi('PriceReport')

export const PriceReportsListSchema = z.object({ reports: z.array(PriceReportSchema) }).openapi('PriceReportsList')
export const SubmitPriceResultSchema = z
  .object({ status: z.enum(['applied', 'pending']), report_id: z.string(), mrp_paise: z.number() })
  .openapi('SubmitPriceResult')
export const ApprovePriceResultSchema = z
  .object({ status: z.enum(['applied', 'pending']), approvals: z.number(), mrp_paise: z.number().optional() })
  .openapi('ApprovePriceResult')

// Authoritative bulk price set (operator / government / licensed data — applies directly).
export const AdminSetPricesSchema = z
  .object({
    items: z
      .array(
        z.object({
          barcode: z.string().min(1),
          mrp_paise: z.number().int().positive(),
          source: z.enum(['gov', 'brand', 'pack', 'other']).default('gov'),
        }),
      )
      .min(1),
  })
  .openapi('AdminSetPrices')

export const AdminSetPricesResultSchema = z
  .object({ set: z.number(), missing: z.array(z.string()) })
  .openapi('AdminSetPricesResult')

// ─── Brand catalog upload (verified owner) ───────────────────────────────────
export const CatalogItemSchema = z
  .object({
    barcode: z.string().default(''),
    name: z.string().default(''),
    mrp_paise: z.number().int().positive().optional(),
    pack: z.string().default(''),
    category: z.string().default(''),
    food_type: z.string().default(''),
  })
  .openapi('CatalogItem')

export const BrandCatalogSchema = z
  .object({ slug: z.string().min(1), items: z.array(CatalogItemSchema).min(1) })
  .openapi('BrandCatalog')

export const BrandCatalogResultSchema = z
  .object({
    created: z.number(),
    updated: z.number(),
    priced: z.number(),
    errors: z.array(z.object({ barcode: z.string(), error: z.string() })),
  })
  .openapi('BrandCatalogResult')
