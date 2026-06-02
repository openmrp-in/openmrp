// Open Food Facts client — live per-barcode lookup for the long tail.
// Behind an interface so the resolve chain is testable without network.
// Note: OFF carries NO MRP; the shop/brand supplies that. We return a *suggestion*.

export interface OffSuggestion {
  barcode: string
  name: string
  brand: string
  image_url: string
  quantity: string
}

export interface OffClient {
  lookup(barcode: string): Promise<OffSuggestion | null>
}

interface OffApiResponse {
  status?: number // 1 = found, 0 = not found
  product?: {
    product_name?: string
    brands?: string
    image_url?: string
    quantity?: string
  }
}

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product'
const USER_AGENT = 'OpenMRP/0.1 (+https://openmrp.in)'

/** Map a raw OFF API response to a suggestion (pure; null when not usable). */
export function mapOffResponse(barcode: string, data: OffApiResponse): OffSuggestion | null {
  if (!data || data.status === 0 || !data.product) return null
  const p = data.product
  const name = (p.product_name ?? '').trim()
  if (!name) return null
  return {
    barcode,
    name,
    brand: (p.brands ?? '').split(',')[0].trim(),
    image_url: (p.image_url ?? '').trim(),
    quantity: (p.quantity ?? '').trim(),
  }
}

/** Construct an OFF client. `fetchImpl` is injectable for tests. */
export function createOffClient(fetchImpl: typeof fetch = fetch, timeoutMs = 4000): OffClient {
  return {
    async lookup(barcode: string): Promise<OffSuggestion | null> {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const url = `${OFF_BASE}/${encodeURIComponent(barcode)}.json?fields=code,product_name,brands,image_url,quantity`
        const res = await fetchImpl(url, {
          headers: { 'User-Agent': USER_AGENT },
          signal: controller.signal,
        })
        if (!res.ok) return null
        const data = (await res.json()) as OffApiResponse
        return mapOffResponse(barcode, data)
      } catch {
        return null
      } finally {
        clearTimeout(timer)
      }
    },
  }
}
