// Thin client for the OpenMRP backend API. Base URL is configurable via the
// PUBLIC_API_BASE env var (defaults to the local wrangler dev backend).
const API_BASE = import.meta.env.PUBLIC_API_BASE ?? 'http://127.0.0.1:8787'

// Reads require an API key; the site uses its own server-side key. Read from
// import.meta.env (.env / build) or process.env (runtime, dev + E2E).
const viteEnv = import.meta.env as Record<string, string | undefined>
const procEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
const authHeaders = { 'X-Api-Key': viteEnv.OPENMRP_API_KEY ?? procEnv?.OPENMRP_API_KEY ?? '' }

export interface Variant {
  id: string
  label: string
  pack_size: number
  unit: string
  barcode: string
  mrp_paise: number
  mrp_source: string
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
  description: string
  ingredients: string
}

export interface Brand {
  id: string
  name: string
  description: string
}

export interface ProductTranslation {
  lang: string
  name: string
  description: string
  ingredients: string
  source: string
  verified: number
}

export interface BrandTranslation {
  lang: string
  name: string
  description: string
  source: string
  verified: number
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
  brand?: Brand | null
  variants?: Variant[]
  translations?: ProductTranslation[]
  brand_translations?: BrandTranslation[]
  off_suggestion?: OffSuggestion
}

/** Resolve a barcode via the public API. 404 => a clean not-found result. */
export async function getProduct(barcode: string): Promise<ResolveResult> {
  const res = await fetch(`${API_BASE}/v1/product/${encodeURIComponent(barcode)}`, { headers: authHeaders })
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
  const res = await fetch(`${API_BASE}/v1/search?q=${encodeURIComponent(q)}&limit=${limit}`, { headers: authHeaders })
  if (!res.ok) return []
  return ((await res.json()) as { results: ProductCard[] }).results
}

/** List brands with product counts. */
export async function listBrands(limit = 200): Promise<BrandSummary[]> {
  const res = await fetch(`${API_BASE}/v1/brands?limit=${limit}`, { headers: authHeaders })
  if (!res.ok) return []
  return ((await res.json()) as { brands: BrandSummary[] }).brands
}

/** List products for a brand slug. */
export async function productsByBrand(slug: string, limit = 60): Promise<ProductCard[]> {
  const res = await fetch(`${API_BASE}/v1/brand/${encodeURIComponent(slug)}?limit=${limit}`, { headers: authHeaders })
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

// ── Open data dump (ODbL) ────────────────────────────────────────────────────
export interface DumpFile {
  path: string
  format: string
  table: string
  rows: number
  bytes: number
  sha256: string
}

export interface DumpManifest {
  name: string
  license: string
  generated_at: string
  total_rows: number
  files: DumpFile[]
}

/** The latest open-data dump manifest (public — no API key). null when none published. */
export async function getDumpManifest(): Promise<DumpManifest | null> {
  const res = await fetch(`${API_BASE}/v1/dump/manifest`)
  if (!res.ok) return null
  return (await res.json()) as DumpManifest
}

/** Absolute download URL for a published dump file. */
export const dumpFileUrl = (name: string): string => `${API_BASE}/v1/dump/file/${name}`

/** Human-readable byte size (B / KB / MB / GB). */
export function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(1)} ${units[i]}`
}
