import { describe, it, expect } from 'vitest'
import { provenance, provenanceBadge } from '../src/lib/translation'

describe('translation provenance', () => {
  it('classifies each source/verified combination', () => {
    expect(provenance('brand', 0)).toEqual({ label: 'official', cls: 'veg' })
    expect(provenance('official', 0)).toEqual({ label: 'official', cls: 'veg' })
    expect(provenance('crowd', 1)).toEqual({ label: 'verified', cls: 'veg' })
    expect(provenance('machine', 0)).toEqual({ label: 'auto-translated', cls: 'egg' })
    expect(provenance('off', 0)).toEqual({ label: 'auto-translated', cls: 'egg' })
    expect(provenance('mt', 0)).toEqual({ label: 'auto-translated', cls: 'egg' })
    expect(provenance('crowd', 0)).toEqual({ label: 'community', cls: '' })
  })

  it('renders an escaped chip', () => {
    expect(provenanceBadge('brand', 0)).toBe('<span class="chip veg">official</span>')
    expect(provenanceBadge('crowd', 0)).toBe('<span class="chip ">community</span>')
  })
})
