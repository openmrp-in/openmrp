// Parse a rupee MRP input ("45", "45.50", "₹1,200") into integer paise.
// Returns null for anything invalid or non-positive — the caller shows an error.
export function paiseFromRupees(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const paise = Math.round(parseFloat(cleaned) * 100)
  return paise > 0 ? paise : null
}

const SOURCE_LABEL: Record<string, string> = { pack: 'from pack', brand: 'brand', other: 'other' }
/** Short provenance label for a variant's MRP source ('' → no MRP reported yet). */
export const mrpSourceLabel = (source: string): string => SOURCE_LABEL[source] ?? source
