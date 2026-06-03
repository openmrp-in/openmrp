import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../src/lib/password'

describe('password', () => {
  it('verifies a correct password', async () => {
    const h = await hashPassword('s3cret-pass')
    expect(await verifyPassword('s3cret-pass', h)).toBe(true)
  })
  it('rejects a wrong password', async () => {
    const h = await hashPassword('s3cret-pass')
    expect(await verifyPassword('wrong-pass', h)).toBe(false)
  })
  it('rejects a malformed hash', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false)
  })
  it('rejects a non-pbkdf2 scheme', async () => {
    expect(await verifyPassword('x', 'scrypt$1$2$3')).toBe(false)
  })
  it('rejects when the stored hash length differs', async () => {
    expect(await verifyPassword('x', 'pbkdf2$100000$ab$short')).toBe(false)
  })
})
