import { escapeHtml } from './moderation'

// Provenance of a translation, derived from its source + verified flag. Brand-official
// and human-verified are trusted; machine/OFF-seeded translations are flagged so readers
// know they're unreviewed; everything else is plain community input.
export interface ProvenanceMeta {
  label: string
  cls: string
}

export function provenance(source: string, verified: number): ProvenanceMeta {
  if (source === 'brand' || source === 'official') return { label: 'official', cls: 'veg' }
  if (verified === 1) return { label: 'verified', cls: 'veg' }
  if (source === 'machine' || source === 'mt' || source === 'off') return { label: 'auto-translated', cls: 'egg' }
  return { label: 'community', cls: '' }
}

export function provenanceBadge(source: string, verified: number): string {
  const p = provenance(source, verified)
  return `<span class="chip ${p.cls}">${escapeHtml(p.label)}</span>`
}
