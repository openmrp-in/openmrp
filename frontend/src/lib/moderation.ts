// Pure, unit-tested helpers shared by the contributor / brand-owner / admin UIs.
// (Astro page scripts import these; the DOM wiring itself is covered by E2E.)

export const REQUIRED_APPROVALS = 2

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
export const escapeHtml = (s: unknown): string => String(s).replace(/[&<>"]/g, (c) => ESC[c])

export interface ProductFields {
  name: string
  description: string
  ingredients: string
  category: string
  food_type: string
  image_url: string
  hsn_code: string
}

export interface TranslationField {
  lang: string
  name: string
  description: string
  ingredients: string
}

export interface EditPayload extends ProductFields {
  translations: TranslationField[]
}

/** Build the full-replace edit payload: trim fields, normalize langs, drop blank-lang rows. */
export function buildEditPayload(fields: ProductFields, translations: TranslationField[]): EditPayload {
  return {
    name: fields.name.trim(),
    description: fields.description.trim(),
    ingredients: fields.ingredients.trim(),
    category: fields.category.trim(),
    food_type: fields.food_type,
    image_url: fields.image_url.trim(),
    hsn_code: fields.hsn_code.trim(),
    translations: translations
      .map((t) => ({
        lang: t.lang.trim().toLowerCase(),
        name: t.name.trim(),
        description: t.description.trim(),
        ingredients: t.ingredients.trim(),
      }))
      .filter((t) => t.lang !== ''),
  }
}

/** "1 / 2 approvals" — clamps the count to the requirement. */
export function approvalText(approvals: number, required = REQUIRED_APPROVALS): string {
  return `${Math.min(approvals, required)} / ${required} approvals`
}

const STATUS_CHIP: Record<string, { cls: string; label: string }> = {
  pending: { cls: 'egg', label: 'pending' },
  applied: { cls: 'veg', label: 'applied' },
  verified: { cls: 'veg', label: 'verified' },
  rejected: { cls: 'non-veg', label: 'rejected' },
}

export function statusChip(status: string): string {
  const s = STATUS_CHIP[status] ?? { cls: '', label: status }
  return `<span class="chip ${s.cls}">${escapeHtml(s.label)}</span>`
}

const ROLE_LABELS: Record<string, string> = {
  contributor: 'Contributor',
  brand_owner: 'Brand owner',
  admin: 'Admin',
}
export const roleLabel = (role: string): string => ROLE_LABELS[role] ?? role

export const canReview = (roles: string[]): boolean => roles.includes('contributor') || roles.includes('admin')
export const isBrandOwner = (roles: string[]): boolean => roles.includes('brand_owner')

/** "v3 — community edit" for a version-history row. */
export function versionLabel(v: { version: number; note: string }): string {
  return `v${v.version} — ${escapeHtml(v.note)}`
}
