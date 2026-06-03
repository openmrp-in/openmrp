import { toHex } from './hex'

const PREFIX = 'omrp_live_'

export interface GeneratedKey {
  /** Full plaintext key — shown to the developer once, never stored. */
  plaintext: string
  /** Public identifier (stored + indexed). */
  prefix: string
  /** SHA-256 of the secret (stored). */
  hash: string
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return toHex(new Uint8Array(digest))
}

/** Generate a new API key: `omrp_live_<prefix>.<secret>`. */
export async function generateApiKey(): Promise<GeneratedKey> {
  const prefix = toHex(crypto.getRandomValues(new Uint8Array(6)))
  const secret = toHex(crypto.getRandomValues(new Uint8Array(24)))
  return { plaintext: `${PREFIX}${prefix}.${secret}`, prefix, hash: await sha256Hex(secret) }
}

/** Split a plaintext key into its prefix + secret, or null if malformed. */
export function parseApiKey(raw: string): { prefix: string; secret: string } | null {
  if (!raw.startsWith(PREFIX)) return null
  const body = raw.slice(PREFIX.length)
  const dot = body.indexOf('.')
  if (dot <= 0) return null
  const prefix = body.slice(0, dot)
  const secret = body.slice(dot + 1)
  if (!secret) return null
  return { prefix, secret }
}

export async function hashSecret(secret: string): Promise<string> {
  return sha256Hex(secret)
}
