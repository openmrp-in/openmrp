import { describe, it, expect } from 'vitest'
import {
  LANGUAGES,
  fontFamilyFor,
  isRtl,
  knownLanguage,
  language,
  languageEndonym,
  languageName,
  sortLanguages,
} from '../src/lib/languages'

describe('language registry', () => {
  it('covers the 22 Eighth-Schedule languages plus English', () => {
    expect(LANGUAGES).toHaveLength(23)
    expect(LANGUAGES.every((l) => l.code && l.name && l.endonym && l.script)).toBe(true)
  })

  it('looks up by code, case-insensitively, with fallbacks', () => {
    expect(language('HI')?.name).toBe('Hindi')
    expect(language('zz')).toBeUndefined()
    expect(knownLanguage('ta')).toBe(true)
    expect(knownLanguage('zz')).toBe(false)
    expect(languageName('te')).toBe('Telugu')
    expect(languageName('zz')).toBe('zz')
    expect(languageEndonym('ta')).toBe('தமிழ்')
    expect(languageEndonym('zz')).toBe('zz')
  })

  it('marks Perso-Arabic-script languages as RTL', () => {
    expect(isRtl('ur')).toBe(true)
    expect(isRtl('ks')).toBe(true)
    expect(isRtl('hi')).toBe(false)
    expect(isRtl('zz')).toBe(false)
  })

  it('maps a script to its Noto font, falling back to the system UI', () => {
    expect(fontFamilyFor('hi')).toContain('Noto Sans Devanagari') // script with a Noto font
    expect(fontFamilyFor('ta')).toContain('Noto Sans Tamil')
    expect(fontFamilyFor('en')).toBe('system-ui, sans-serif') // Latin → no Noto
    expect(fontFamilyFor('zz')).toBe('system-ui, sans-serif') // unknown → no script
  })

  it('sorts by Eighth-Schedule order with unknowns last (alphabetical)', () => {
    expect(sortLanguages(['ta', 'hi', 'zz', 'aa'])).toEqual(['hi', 'ta', 'aa', 'zz'])
    expect(sortLanguages(['TA', 'en'])).toEqual(['en', 'TA']) // case-insensitive ordering
  })
})
