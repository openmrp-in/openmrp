// Thin client for the OpenMRP backend API. Base URL is configurable via the
// PUBLIC_API_BASE env var (defaults to the local wrangler dev backend).
const API_BASE = import.meta.env.PUBLIC_API_BASE ?? 'http://127.0.0.1:8787'

export interface Variant {
  id: string
  label: string
  pack_size: number
  unit: string
  barcode: string
  mrp_paise: number
}

export interface Product {
  id: string
  brand_id: string | null
  name: string
  group_key: string
  image_url: string
  hsn_code: string
  category: string
  food_type: string
}

export interface ProductName {
  lang: string
  name: string
}

export interface OffSuggestion {
  barcode: string
  name: string
  brand: string
  image_url: string
  quantity: string
}

export interface ResolveResult {
  found: boolean
  source: 'crowd' | 'off' | 'none'
  product?: Product
  variants?: Variant[]
  names?: ProductName[]
  off_suggestion?: OffSuggestion
}

/** Resolve a barcode via the public API. 404 => a clean not-found result. */
export async function getProduct(barcode: string): Promise<ResolveResult> {
  const res = await fetch(`${API_BASE}/v1/product/${encodeURIComponent(barcode)}`)
  if (res.status === 404) return { found: false, source: 'none' }
  if (!res.ok) throw new Error(`OpenMRP API error ${res.status}`)
  return (await res.json()) as ResolveResult
}

/** Format integer paise as Indian rupees. */
export function rupees(paise: number): string {
  return (paise / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
}

export interface ProductCard {
  barcode: string
  name: string
  brand: string
  food_type: string
  mrp_paise: number
}

export interface BrandSummary {
  slug: string
  name: string
  product_count: number
}

/** Search products by name. Returns [] on any error (degrade gracefully). */
export async function search(q: string, limit = 30): Promise<ProductCard[]> {
  const res = await fetch(`${API_BASE}/v1/search?q=${encodeURIComponent(q)}&limit=${limit}`)
  if (!res.ok) return []
  return ((await res.json()) as { results: ProductCard[] }).results
}

/** List brands with product counts. */
export async function listBrands(limit = 200): Promise<BrandSummary[]> {
  const res = await fetch(`${API_BASE}/v1/brands?limit=${limit}`)
  if (!res.ok) return []
  return ((await res.json()) as { brands: BrandSummary[] }).brands
}

/** List products for a brand slug. */
export async function productsByBrand(slug: string, limit = 60): Promise<ProductCard[]> {
  const res = await fetch(`${API_BASE}/v1/brand/${encodeURIComponent(slug)}?limit=${limit}`)
  if (!res.ok) return []
  return ((await res.json()) as { results: ProductCard[] }).results
}

const FOOD_TYPE_LABELS: Record<string, string> = {
  veg: 'Veg',
  'non-veg': 'Non-veg',
  egg: 'Contains egg',
}

export function foodTypeLabel(foodType: string): string {
  return FOOD_TYPE_LABELS[foodType] ?? foodType
}
