import type { Env } from '../env'

/** A party (company) record resolved from GEPIR for a GTIN. */
export interface GepirParty {
  company_name: string
  gln?: string
}

/** The brand fields a claim is matched against. */
export interface ClaimBrand {
  name: string
  manufacturer: string
}

export interface AutoVerifyResult {
  verified: boolean
  /** The company name GEPIR returned, if any (recorded on the claim for audit). */
  gepir_company: string
}

/** Normalize a company/brand name for fuzzy comparison (case, punctuation, suffixes). */
export function normalizeCompany(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(pvt|private|ltd|limited|inc|llp|llc|co|company|corp|corporation|gmbh)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/** True when two company/brand names plausibly refer to the same entity. */
export function companyMatches(a: string, b: string): boolean {
  const na = normalizeCompany(a)
  const nb = normalizeCompany(b)
  if (na === '' || nb === '') return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

/** Resolve a GTIN to its GS1 party via the configured GEPIR proxy. null when unset/unknown/error. */
export async function gepirLookup(env: Env, gtin: string): Promise<GepirParty | null> {
  if (!env.GEPIR_BASE_URL) return null
  const url = `${env.GEPIR_BASE_URL.replace(/\/$/, '')}/gtin/${encodeURIComponent(gtin)}`
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } })
    if (!res.ok) return null
    const body = (await res.json()) as GepirParty
    if (!body || typeof body.company_name !== 'string' || body.company_name === '') return null
    return body
  } catch {
    return null // network/parse failure → fail closed to manual review
  }
}

/**
 * Auto-verify a brand-ownership claim: confirm the GTIN's GS1 party matches the
 * claimed company or the brand. Returns verified=false (→ manual review) when
 * GEPIR is unconfigured, the GTIN is unknown, or the names don't match.
 */
export async function autoVerifyClaim(
  env: Env,
  gtin: string,
  claimedCompany: string,
  brand: ClaimBrand,
): Promise<AutoVerifyResult> {
  const party = await gepirLookup(env, gtin)
  if (!party) return { verified: false, gepir_company: '' }
  const verified =
    companyMatches(party.company_name, claimedCompany) ||
    companyMatches(party.company_name, brand.manufacturer) ||
    companyMatches(party.company_name, brand.name)
  return { verified, gepir_company: party.company_name }
}
