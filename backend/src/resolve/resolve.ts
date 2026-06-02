import type { ProductStore } from '../db/queries'
import type { ProductNameRow, ProductRow, VariantRow } from '../db/schema'
import type { OffClient, OffSuggestion } from './off'

export interface ResolveResult {
  found: boolean
  /** 'crowd' = our DB · 'off' = Open Food Facts suggestion (no MRP) · 'none' = miss */
  source: 'crowd' | 'off' | 'none'
  product?: ProductRow
  variants?: VariantRow[]
  names?: ProductNameRow[]
  off_suggestion?: OffSuggestion
}

/**
 * The barcode-resolve chain (pure; dependencies injected):
 *   1. our crowd database  → full product + MRP
 *   2. Open Food Facts     → suggestion (no MRP; not persisted here)
 *   3. miss                → found: false
 */
export async function resolveBarcode(
  barcode: string,
  store: ProductStore,
  off: OffClient,
): Promise<ResolveResult> {
  const trimmed = barcode.trim()
  if (!trimmed) return { found: false, source: 'none' }

  const crowd = await store.findByBarcode(trimmed)
  if (crowd) {
    return {
      found: true,
      source: 'crowd',
      product: crowd.product,
      variants: crowd.variants,
      names: crowd.names,
    }
  }

  const suggestion = await off.lookup(trimmed)
  if (suggestion) return { found: true, source: 'off', off_suggestion: suggestion }

  return { found: false, source: 'none' }
}
