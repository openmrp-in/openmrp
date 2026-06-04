// The 22 languages of the Indian Constitution's Eighth Schedule (+ English as the
// canonical base), with native endonyms, script, RTL flag, and the Noto font that
// renders each script. Pure data + helpers — unit-tested to 100%.

export interface Language {
  code: string
  name: string
  endonym: string
  script: string
  rtl: boolean
}

// Canonical order: English first (canonical text), then the Eighth Schedule alphabetically.
export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', endonym: 'English', script: 'Latin', rtl: false },
  { code: 'as', name: 'Assamese', endonym: 'অসমীয়া', script: 'Bengali', rtl: false },
  { code: 'bn', name: 'Bengali', endonym: 'বাংলা', script: 'Bengali', rtl: false },
  { code: 'brx', name: 'Bodo', endonym: 'बड़ो', script: 'Devanagari', rtl: false },
  { code: 'doi', name: 'Dogri', endonym: 'डोगरी', script: 'Devanagari', rtl: false },
  { code: 'gu', name: 'Gujarati', endonym: 'ગુજરાતી', script: 'Gujarati', rtl: false },
  { code: 'hi', name: 'Hindi', endonym: 'हिन्दी', script: 'Devanagari', rtl: false },
  { code: 'kn', name: 'Kannada', endonym: 'ಕನ್ನಡ', script: 'Kannada', rtl: false },
  { code: 'ks', name: 'Kashmiri', endonym: 'کٲشُر', script: 'Arabic', rtl: true },
  { code: 'kok', name: 'Konkani', endonym: 'कोंकणी', script: 'Devanagari', rtl: false },
  { code: 'mai', name: 'Maithili', endonym: 'मैथिली', script: 'Devanagari', rtl: false },
  { code: 'ml', name: 'Malayalam', endonym: 'മലയാളം', script: 'Malayalam', rtl: false },
  { code: 'mni', name: 'Manipuri', endonym: 'মণিপুরী', script: 'Bengali', rtl: false },
  { code: 'mr', name: 'Marathi', endonym: 'मराठी', script: 'Devanagari', rtl: false },
  { code: 'ne', name: 'Nepali', endonym: 'नेपाली', script: 'Devanagari', rtl: false },
  { code: 'or', name: 'Odia', endonym: 'ଓଡ଼ିଆ', script: 'Oriya', rtl: false },
  { code: 'pa', name: 'Punjabi', endonym: 'ਪੰਜਾਬੀ', script: 'Gurmukhi', rtl: false },
  { code: 'sa', name: 'Sanskrit', endonym: 'संस्कृतम्', script: 'Devanagari', rtl: false },
  { code: 'sat', name: 'Santali', endonym: 'ᱥᱟᱱᱛᱟᱲᱤ', script: 'Ol Chiki', rtl: false },
  { code: 'sd', name: 'Sindhi', endonym: 'सिन्धी', script: 'Devanagari', rtl: false },
  { code: 'ta', name: 'Tamil', endonym: 'தமிழ்', script: 'Tamil', rtl: false },
  { code: 'te', name: 'Telugu', endonym: 'తెలుగు', script: 'Telugu', rtl: false },
  { code: 'ur', name: 'Urdu', endonym: 'اردو', script: 'Arabic', rtl: true },
]

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]))

// Script → Noto font family (loaded via Google Fonts in the layout, unicode-range
// subset so only scripts actually rendered are downloaded). Latin uses the system UI.
const SCRIPT_FONT: Record<string, string> = {
  Devanagari: "'Noto Sans Devanagari'",
  Bengali: "'Noto Sans Bengali'",
  Gujarati: "'Noto Sans Gujarati'",
  Gurmukhi: "'Noto Sans Gurmukhi'",
  Kannada: "'Noto Sans Kannada'",
  Malayalam: "'Noto Sans Malayalam'",
  Oriya: "'Noto Sans Oriya'",
  Tamil: "'Noto Sans Tamil'",
  Telugu: "'Noto Sans Telugu'",
  'Ol Chiki': "'Noto Sans Ol Chiki'",
  Arabic: "'Noto Sans Arabic'",
}

export const language = (code: string): Language | undefined => BY_CODE.get(code.toLowerCase())
export const knownLanguage = (code: string): boolean => BY_CODE.has(code.toLowerCase())
export const languageName = (code: string): string => language(code)?.name ?? code
export const languageEndonym = (code: string): string => language(code)?.endonym ?? code
export const isRtl = (code: string): boolean => language(code)?.rtl ?? false

/** CSS font-family stack for a language's script (Noto + fallback). */
export function fontFamilyFor(code: string): string {
  const script = language(code)?.script
  const noto = script ? SCRIPT_FONT[script] : undefined
  return noto ? `${noto}, system-ui, sans-serif` : 'system-ui, sans-serif'
}

/** Sort language codes by the Eighth-Schedule order; unknown codes last, then alphabetical. */
export function sortLanguages(codes: string[]): string[] {
  const order = new Map(LANGUAGES.map((l, i) => [l.code, i]))
  return [...codes].sort((a, b) => {
    const ia = order.get(a.toLowerCase()) ?? Infinity
    const ib = order.get(b.toLowerCase()) ?? Infinity
    return ia !== ib ? ia - ib : a.localeCompare(b)
  })
}
