/** Per-language product text. */
export interface ProductTranslationInput {
  lang: string
  name: string
  description: string
  ingredients: string
}

/** Per-language brand text. */
export interface BrandTranslationInput {
  lang: string
  name: string
  description: string
}

/** Input accepted by POST /v1/products (admin create). */
export interface CreateProductInput {
  brand?: {
    name: string
    slug?: string
    manufacturer?: string
    description: string
    translations: BrandTranslationInput[]
  }
  product: {
    name: string
    group_key?: string
    image_url?: string
    hsn_code?: string
    category?: string
    food_type: string
    description: string
    ingredients: string
  }
  variants: Array<{
    label?: string
    pack_size?: number
    unit?: string
    barcode?: string
    mrp_paise?: number
  }>
  translations: ProductTranslationInput[]
}

const FOOD_TYPES = new Set(['veg', 'non-veg', 'egg', 'none'])

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Validate and normalize a create-product payload. Pure: returns the cleaned value
 * (every text field defaulted) plus a list of errors (empty list = valid).
 */
export function validateCreateProduct(body: unknown): {
  value: CreateProductInput
  errors: string[]
} {
  const errors: string[] = []
  const b = asRecord(body)

  // product
  const product = asRecord(b.product)
  const productName = str(product.name)
  if (!productName) errors.push('product.name is required')
  const foodType = typeof product.food_type === 'string' ? product.food_type : 'none'
  if (!FOOD_TYPES.has(foodType)) {
    errors.push(`product.food_type must be one of: ${[...FOOD_TYPES].join(', ')}`)
  }

  // variants
  const rawVariants = Array.isArray(b.variants) ? b.variants : []
  if (rawVariants.length === 0) errors.push('at least one variant is required')
  const variants = rawVariants.map((rv, i) => {
    const v = asRecord(rv)
    if (v.mrp_paise !== undefined && (typeof v.mrp_paise !== 'number' || !Number.isInteger(v.mrp_paise) || v.mrp_paise < 0)) {
      errors.push(`variants[${i}].mrp_paise must be a non-negative integer`)
    }
    if (v.barcode !== undefined && typeof v.barcode !== 'string') {
      errors.push(`variants[${i}].barcode must be a string`)
    }
    return {
      label: typeof v.label === 'string' ? v.label : undefined,
      pack_size: typeof v.pack_size === 'number' ? v.pack_size : undefined,
      unit: typeof v.unit === 'string' ? v.unit : undefined,
      barcode: typeof v.barcode === 'string' ? v.barcode.trim() : undefined,
      mrp_paise: typeof v.mrp_paise === 'number' ? v.mrp_paise : undefined,
    }
  })

  // product translations
  const rawTranslations = Array.isArray(b.translations) ? b.translations : []
  const translations: ProductTranslationInput[] = rawTranslations.map((rt, i) => {
    const t = asRecord(rt)
    const lang = str(t.lang)
    if (!lang) errors.push(`translations[${i}].lang is required`)
    return { lang, name: str(t.name), description: str(t.description), ingredients: str(t.ingredients) }
  })

  // brand (optional)
  let brand: CreateProductInput['brand']
  if (b.brand !== undefined) {
    const br = asRecord(b.brand)
    const brandName = str(br.name)
    if (!brandName) errors.push('brand.name is required when brand is provided')
    const rawBrandTr = Array.isArray(br.translations) ? br.translations : []
    const brandTranslations: BrandTranslationInput[] = rawBrandTr.map((rt, i) => {
      const t = asRecord(rt)
      const lang = str(t.lang)
      if (!lang) errors.push(`brand.translations[${i}].lang is required`)
      return { lang, name: str(t.name), description: str(t.description) }
    })
    brand = {
      name: brandName,
      slug: typeof br.slug === 'string' ? br.slug : undefined,
      manufacturer: typeof br.manufacturer === 'string' ? br.manufacturer : undefined,
      description: str(br.description),
      translations: brandTranslations,
    }
  }

  const value: CreateProductInput = {
    brand,
    product: {
      name: productName,
      group_key: typeof product.group_key === 'string' ? product.group_key : undefined,
      image_url: typeof product.image_url === 'string' ? product.image_url : undefined,
      hsn_code: typeof product.hsn_code === 'string' ? product.hsn_code : undefined,
      category: typeof product.category === 'string' ? product.category : undefined,
      food_type: foodType,
      description: str(product.description),
      ingredients: str(product.ingredients),
    },
    variants,
    translations,
  }
  return { value, errors }
}
