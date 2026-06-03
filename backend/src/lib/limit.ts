/** Parse a string query limit, falling back to `def` and capping at `max`. */
export function clampLimit(raw: string | undefined, def: number, max: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return def
  return Math.min(Math.floor(n), max)
}
