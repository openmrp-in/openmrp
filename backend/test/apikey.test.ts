import { describe, it, expect } from 'vitest'
import { generateApiKey, parseApiKey, hashSecret } from '../src/lib/apikey'

describe('apikey', () => {
  it('generates a key whose parts round-trip', async () => {
    const gen = await generateApiKey()
    expect(gen.plaintext.startsWith('omrp_live_')).toBe(true)
    const parsed = parseApiKey(gen.plaintext)
    expect(parsed?.prefix).toBe(gen.prefix)
    expect(await hashSecret(parsed!.secret)).toBe(gen.hash)
  })
  it('rejects a key without the prefix', () => expect(parseApiKey('nope.abc')).toBeNull())
  it('rejects a key with no dot', () => expect(parseApiKey('omrp_live_abcdef')).toBeNull())
  it('rejects a dot at position 0', () => expect(parseApiKey('omrp_live_.secret')).toBeNull())
  it('rejects an empty secret', () => expect(parseApiKey('omrp_live_prefix.')).toBeNull())
})
