// Minimal ULID generator — 26-char Crockford base32, time-sortable.
// 10 chars of millisecond timestamp + 16 chars of randomness.
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford base32 (no I, L, O, U)

/** Generate a ULID. `now` is injectable for deterministic tests. */
export function ulid(now: number = Date.now()): string {
  let time = now
  const timeChars = new Array<string>(10)
  for (let i = 9; i >= 0; i--) {
    timeChars[i] = ENCODING[time % 32]
    time = Math.floor(time / 32)
  }
  const rand = new Uint8Array(16)
  crypto.getRandomValues(rand)
  let randChars = ''
  for (let i = 0; i < 16; i++) {
    randChars += ENCODING[rand[i] % 32]
  }
  return timeChars.join('') + randChars
}
