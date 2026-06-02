/** Input accepted by POST /v1/products (admin create). */
export interface CreateProductInput {
  brand?: { name: string; slug?: string; manufacturer?: string }
  product: {
    name: string
    group_key?: string
    image_url?: string
    hsn_code?: string
    category?: string
    food_type: string
  }
  variants: Array<{
    label?: string
    pack_size?: number
    unit?: string
    barcode?: string
    mrp_paise?: number
  }>
  names: Array<{ lang: string; name: string }>
}

const FOOD_TYPES = new Set(['veg', 'non-veg', 'egg', 'none'])

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

/**
 * Validate and normalize a create-product payload. Pure: returns the cleaned value
 * plus a list of human-readable errors (empty list = valid).
 */
export function validateCreateProduct(body: unknown): {
  value: CreateProductInput
  errors: string[]
} {
  const errors: string[] = []
  const b = asRecord(body)

  // product
  const product = asRecord(b.product)
  const productName = typeof product.name === 'string' ? product.name.trim() : ''
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
    if (v.mrp_paise !== undefined) {
      if (typeof v.mrp_paise !== 'number' || !Number.isInteger(v.mrp_paise) || v.mrp_paise < 0) {
        errors.push(`variants[${i}].mrp_paise must be a non-negative integer`)
      }
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

  // names (multilingual, optional)
  const rawNames = Array.isArray(b.names) ? b.names : []
  const names = rawNames.map((rn, i) => {
    const n = asRecord(rn)
    const lang = typeof n.lang === 'string' ? n.lang.trim() : ''
    const name = typeof n.name === 'string' ? n.name.trim() : ''
    if (!lang) errors.push(`names[${i}].lang is required`)
    if (!name) errors.push(`names[${i}].name is required`)
    return { lang, name }
  })

  // brand (optional)
  let brand: CreateProductInput['brand']
  if (b.brand !== undefined) {
    const br = asRecord(b.brand)
    const brandName = typeof br.name === 'string' ? br.name.trim() : ''
    if (!brandName) errors.push('brand.name is required when brand is provided')
    brand = {
      name: brandName,
      slug: typeof br.slug === 'string' ? br.slug : undefined,
      manufacturer: typeof br.manufacturer === 'string' ? br.manufacturer : undefined,
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
    },
    variants,
    names,
  }
  return { value, errors }
}
