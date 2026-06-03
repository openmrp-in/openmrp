import { describe, it, expect } from 'vitest'
import {
  REQUIRED_APPROVALS,
  approvalText,
  buildEditPayload,
  canReview,
  escapeHtml,
  isBrandOwner,
  roleLabel,
  statusChip,
  versionLabel,
} from '../src/lib/moderation'

describe('escapeHtml', () => {
  it('escapes the dangerous characters and passes the rest through', () => {
    expect(escapeHtml('<a href="x">Tom & Jerry</a>')).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&lt;/a&gt;')
    expect(escapeHtml('plain')).toBe('plain')
    expect(escapeHtml(42)).toBe('42')
  })
})

describe('buildEditPayload', () => {
  const fields = {
    name: '  Parle-G  ',
    description: ' tasty ',
    ingredients: ' wheat ',
    category: ' Biscuits ',
    food_type: 'veg',
    image_url: ' http://x/y.jpg ',
    hsn_code: ' 1905 ',
  }

  it('trims fields, normalizes langs, and drops blank-lang translations', () => {
    const out = buildEditPayload(fields, [
      { lang: ' HI ', name: ' पारले ', description: '', ingredients: ' गेहूं ' },
      { lang: '', name: 'ignored', description: '', ingredients: '' },
    ])
    expect(out).toEqual({
      name: 'Parle-G',
      description: 'tasty',
      ingredients: 'wheat',
      category: 'Biscuits',
      food_type: 'veg',
      image_url: 'http://x/y.jpg',
      hsn_code: '1905',
      translations: [{ lang: 'hi', name: 'पारले', description: '', ingredients: 'गेहूं' }],
    })
  })

  it('keeps an empty translations list', () => {
    expect(buildEditPayload(fields, []).translations).toEqual([])
  })
})

describe('approvalText', () => {
  it('formats and clamps to the requirement', () => {
    expect(approvalText(0)).toBe(`0 / ${REQUIRED_APPROVALS} approvals`)
    expect(approvalText(1)).toBe('1 / 2 approvals')
    expect(approvalText(5)).toBe('2 / 2 approvals') // clamped
    expect(approvalText(1, 3)).toBe('1 / 3 approvals')
  })
})

describe('statusChip', () => {
  it('renders known statuses with their colour class', () => {
    expect(statusChip('pending')).toContain('chip egg')
    expect(statusChip('applied')).toContain('chip veg')
    expect(statusChip('verified')).toContain('chip veg')
    expect(statusChip('rejected')).toContain('chip non-veg')
  })
  it('falls back for an unknown status', () => {
    expect(statusChip('weird')).toBe('<span class="chip ">weird</span>')
  })
})

describe('roles', () => {
  it('labels known roles and passes unknowns through', () => {
    expect(roleLabel('contributor')).toBe('Contributor')
    expect(roleLabel('brand_owner')).toBe('Brand owner')
    expect(roleLabel('admin')).toBe('Admin')
    expect(roleLabel('wizard')).toBe('wizard')
  })
  it('gates reviewing on contributor or admin', () => {
    expect(canReview(['contributor'])).toBe(true)
    expect(canReview(['admin'])).toBe(true)
    expect(canReview(['brand_owner'])).toBe(false)
    expect(canReview([])).toBe(false)
  })
  it('detects brand owners', () => {
    expect(isBrandOwner(['brand_owner'])).toBe(true)
    expect(isBrandOwner(['contributor'])).toBe(false)
  })
})

describe('versionLabel', () => {
  it('formats a version row and escapes the note', () => {
    expect(versionLabel({ version: 3, note: 'community <edit>' })).toBe('v3 — community &lt;edit&gt;')
  })
})
