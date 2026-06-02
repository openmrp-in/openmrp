// Seeding types + pure transforms. Shared by the bulk endpoint (normalizeSeedItem)
// and the seed script (cacheItemToSeedItem).

/** A normalized item ready for bulk upsert — every field present. */
export interface SeedItem {
  barcode: string
  name: string
  brand: string
  pack_size: number
  unit: string
  food_type: string
  group_key: string
}

const FOOD_TYPES = new Set(['veg', 'non-veg', 'egg', 'none'])

/** Clamp an arbitrary value to a known food type, defaulting to 'none'. */
export function clampFoodType(value: unknown): string {
  return typeof value === 'string' && FOOD_TYPES.has(value) ? value : 'none'
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Normalize a raw bulk-request item. Returns a fully-defaulted SeedItem, or null
 * when it lacks the two required fields (barcode + name).
 */
export function normalizeSeedItem(raw: unknown): SeedItem | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const barcode = str(r.barcode)
  const name = str(r.name)
  if (!barcode || !name) return null
  const groupKey = str(r.group_key)
  return {
    barcode,
    name,
    brand: str(r.brand),
    pack_size: typeof r.pack_size === 'number' ? r.pack_size : 0,
    unit: str(r.unit),
    food_type: clampFoodType(r.food_type),
    group_key: groupKey || name,
  }
}

/** Shape of an item in the .off-cache page files (CliqBill seeder output). */
export interface CacheItem {
  Barcode?: string
  Name?: string
  Brand?: string
  PackSize?: number
  Unit?: string
  FoodType?: string
  GroupKey?: string
}

/** Map a cached OFF page item (PascalCase) to the bulk wire shape (snake_case). */
export function cacheItemToSeedItem(raw: CacheItem): Record<string, unknown> {
  return {
    barcode: str(raw.Barcode),
    name: str(raw.Name),
    brand: str(raw.Brand),
    pack_size: typeof raw.PackSize === 'number' ? raw.PackSize : 0,
    unit: str(raw.Unit),
    food_type: clampFoodType(raw.FoodType),
    group_key: str(raw.GroupKey),
  }
}
