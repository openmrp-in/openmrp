import { describe, it, expect } from 'vitest'
import { slugify } from '../src/lib/slug'

describe('slugify', () => {
  it('lowercases and hyphenates words', () => {
    expect(slugify('Aachi Chilli Masala')).toBe('aachi-chilli-masala')
  })

  it('collapses separators and trims edges', () => {
    expect(slugify('  Hello,  World!!  ')).toBe('hello-world')
  })

  it('passes through already-clean input', () => {
    expect(slugify('simple')).toBe('simple')
  })

  it('returns an empty string for all-symbol input', () => {
    expect(slugify('@#$')).toBe('')
  })
})
