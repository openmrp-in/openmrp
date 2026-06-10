// Parse a rupee MRP input ("45", "45.50", "₹1,200", "Rs. 45") into integer paise.
// Returns null for anything invalid or non-positive — the caller shows an error.
export function paiseFromRupees(input: string): number | null {
  const normalized = input.trim()
  const cleaned = normalized.replace(/^(?:₹|rs\.?|inr)\s*/i, '')
  const hasValidSeparators = /^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,3}(?:,\d{2})+,\d{3})(?:\.\d{1,2})?$/.test(cleaned)
  if (!hasValidSeparators) return null
  const paise = Math.round(Number(cleaned.replace(/,/g, '')) * 100)
  return paise > 0 ? paise : null
}

const SOURCE_LABEL: Record<string, string> = { pack: 'from pack', brand: 'brand', gov: 'govt (NPPA)', other: 'other' }
/** Short provenance label for a variant's MRP source ('' → no MRP reported yet). */
export const mrpSourceLabel = (source: string): string => SOURCE_LABEL[source] ?? source
