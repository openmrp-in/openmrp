/** Additive account roles + verified brand ownership. */
export type Role = 'contributor' | 'brand_owner' | 'admin'
export const ROLES: readonly Role[] = ['contributor', 'brand_owner', 'admin']

export interface OwnedBrand {
  brand_id: string
  slug: string
  name: string
  status: string
  method: string
  created_at: string
}

export function createRolesStore(db: D1Database) {
  return {
    async grantRole(accountId: string, role: Role, grantedBy: string, now: string): Promise<void> {
      await db
        .prepare('INSERT OR IGNORE INTO account_roles (account_id, role, granted_by, created_at) VALUES (?, ?, ?, ?)')
        .bind(accountId, role, grantedBy, now)
        .run()
    },

    async revokeRole(accountId: string, role: Role): Promise<boolean> {
      const res = await db
        .prepare('DELETE FROM account_roles WHERE account_id = ? AND role = ?')
        .bind(accountId, role)
        .run()
      return res.meta.changes > 0
    },

    async listRoles(accountId: string): Promise<Role[]> {
      const rows = await db
        .prepare('SELECT role FROM account_roles WHERE account_id = ? ORDER BY role')
        .bind(accountId)
        .all<{ role: Role }>()
      return rows.results.map((r) => r.role)
    },

    async hasRole(accountId: string, role: Role): Promise<boolean> {
      const row = await db
        .prepare('SELECT 1 AS x FROM account_roles WHERE account_id = ? AND role = ?')
        .bind(accountId, role)
        .first<{ x: number }>()
      return row !== null
    },

    // ── Verified brand ownership ──────────────────────────────────────────────
    async grantBrandOwner(accountId: string, brandId: string, method: string, now: string): Promise<void> {
      await db
        .prepare(
          "INSERT INTO brand_owners (account_id, brand_id, status, method, created_at) VALUES (?, ?, 'verified', ?, ?) " +
            "ON CONFLICT (account_id, brand_id) DO UPDATE SET status='verified', method=excluded.method",
        )
        .bind(accountId, brandId, method, now)
        .run()
    },

    async isVerifiedOwner(accountId: string, brandId: string): Promise<boolean> {
      const row = await db
        .prepare("SELECT 1 AS x FROM brand_owners WHERE account_id = ? AND brand_id = ? AND status = 'verified'")
        .bind(accountId, brandId)
        .first<{ x: number }>()
      return row !== null
    },

    async listOwnedBrands(accountId: string): Promise<OwnedBrand[]> {
      const rows = await db
        .prepare(
          'SELECT bo.brand_id, b.slug, b.name, bo.status, bo.method, bo.created_at FROM brand_owners bo JOIN brands b ON b.id = bo.brand_id WHERE bo.account_id = ? ORDER BY bo.created_at DESC',
        )
        .bind(accountId)
        .all<OwnedBrand>()
      return rows.results
    },
  }
}
