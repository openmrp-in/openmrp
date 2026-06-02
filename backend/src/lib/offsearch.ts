// Open Food Facts search + transform — lets the seeder pull India product FACTS
// directly from OFF (no MRP, no images), so OpenMRP can self-seed without any
// external cache. Ported from CliqBill's Go seeder; rows are source='off' and
// require "Data from Open Food Facts" attribution (ODbL).
import { slugify } from './slug'
import type { CacheItem } from './seed'

export const OFF_USER_AGENT = 'OpenMRP-Seeder/1.0 (+https://openmrp.in; India grocery facts seed)'

const OFF_BASE = 'https://world.openfoodfacts.org'
const OFF_FIELDS = 'code,product_name,brands,quantity,labels_tags'

/** Raw OFF product (subset of fields we request). */
export interface OffProduct {
  code?: string
  product_name?: string
  brands?: string
  quantity?: string
  labels_tags?: string[]
}

/** Raw OFF /api/v2/search response (subset). */
export interface OffSearchResponse {
  count?: number
  page?: number
  page_size?: number
  products?: OffProduct[]
}

/** Build the OFF search URL for one page of India products, popularity-first. */
export function buildSearchUrl(page: number, pageSize: number): string {
  const q = new URLSearchParams({
    countries_tags: 'en:india',
    fields: OFF_FIELDS,
    sort_by: 'unique_scans_n',
    page: String(page),
    page_size: String(pageSize),
  })
  return `${OFF_BASE}/api/v2/search?${q.toString()}`
}

const QUANTITY_RE = /^\s*([0-9]+(?:[.,][0-9]+)?)\s*([a-zµμ]+)?/i

const UNIT_SYNONYMS: Record<string, string> = {
  gram: 'g',
  grams: 'g',
  gm: 'g',
  gms: 'g',
  kilogram: 'kg',
  kilograms: 'kg',
  kgs: 'kg',
  litre: 'l',
  litres: 'l',
  liter: 'l',
  liters: 'l',
  millilitre: 'ml',
  millilitres: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
}

function normaliseUnit(u: string): string {
  const v = u.toLowerCase().trim()
  return UNIT_SYNONYMS[v] ?? v
}

/** Parse an OFF quantity string ("1.5 kg", "200g", "500 ML") to [size, unit]. */
export function parseQuantity(raw: string): [number, string] {
  const m = QUANTITY_RE.exec(raw)
  if (!m) return [0, '']
  return [parseFloat(m[1].replace(',', '.')), normaliseUnit(m[2] ?? '')]
}

/** Map OFF labels_tags ("en:non-vegetarian", "en:vegan", …) to our food_type enum. */
export function foodTypeFromLabels(labels: string[]): string {
  let nonVeg = false
  let veg = false
  let egg = false
  for (const raw of labels) {
    const l = raw.toLowerCase()
    if (l.includes('non-vegetarian') || l.includes('non-veg')) nonVeg = true
    else if (l.includes('egg')) egg = true
    else if (l.includes('vegan') || l.includes('vegetarian')) veg = true
  }
  if (nonVeg) return 'non-veg'
  if (egg) return 'egg'
  if (veg) return 'veg'
  return 'none'
}

/** Cap a string to max characters (code-point safe), so OFF junk can't overflow. */
export function truncate(s: string, max: number): string {
  const r = [...s]
  return r.length <= max ? s : r.slice(0, max).join('')
}

function firstCsv(s: string): string {
  if (s === '') return ''
  return s.split(',')[0].trim()
}

/** GS1 mod-10 check digit for a key body (digits excluding the trailing check). */
export function gs1CheckDigit(body: string): number {
  let sum = 0
  for (let i = 0; i < body.length; i++) {
    const d = body.charCodeAt(body.length - 1 - i) - 48
    sum += i % 2 === 0 ? d * 3 : d
  }
  return (10 - (sum % 10)) % 10
}

/** Structural GS1 validity: EAN-8 / UPC-A(12) / EAN-13 / GTIN-14 with a valid check digit. */
export function validBarcode(code: string): boolean {
  const c = code.trim()
  if (![8, 12, 13, 14].includes(c.length)) return false
  if (!/^[0-9]+$/.test(c)) return false
  return gs1CheckDigit(c.slice(0, -1)) === Number(c[c.length - 1])
}

/** Map a raw OFF product to a cache item (the seeder's common wire shape). */
export function mapOffProduct(p: OffProduct): CacheItem {
  const name = truncate((p.product_name ?? '').trim(), 255)
  const brand = truncate(firstCsv(p.brands ?? ''), 120)
  let [size, unit] = parseQuantity((p.quantity ?? '').trim())
  // Guard junk OFF quantities (overflow / absurd pack sizes) -> unparseable.
  if (unit.length > 10 || size > 1_000_000) {
    size = 0
    unit = ''
  }
  return {
    Barcode: (p.code ?? '').trim(),
    Name: name,
    Brand: brand,
    PackSize: size,
    Unit: unit,
    FoodType: foodTypeFromLabels(p.labels_tags ?? []),
    GroupKey: slugify([brand, name].join('-')),
  }
}
