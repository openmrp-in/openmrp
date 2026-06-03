import { ulid } from '../lib/ulid'

export interface BrandClaimRow {
  id: string
  account_id: string
  brand_id: string
  gtin: string
  claimed_company: string
  gepir_company: string
  status: string
  method: string
  resolved_by: string
  resolved_at: string
  created_at: string
}

export interface ClaimBrandRow {
  id: string
  name: string
  manufacturer: string
}

export function createClaimsStore(db: D1Database) {
  return {
    findBrandBySlug(slug: string): Promise<ClaimBrandRow | null> {
      return db.prepare('SELECT id, name, manufacturer FROM brands WHERE slug = ?').bind(slug).first<ClaimBrandRow>()
    },

    async create(c: {
      accountId: string
      brandId: string
      gtin: string
      claimedCompany: string
      gepirCompany: string
      status: string
      method: string
      resolvedBy: string
      resolvedAt: string
      now: string
    }): Promise<string> {
      const id = ulid()
      await db
        .prepare(
          'INSERT INTO brand_claims (id, account_id, brand_id, gtin, claimed_company, gepir_company, status, method, resolved_by, resolved_at, created_at) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          id,
          c.accountId,
          c.brandId,
          c.gtin,
          c.claimedCompany,
          c.gepirCompany,
          c.status,
          c.method,
          c.resolvedBy,
          c.resolvedAt,
          c.now,
        )
        .run()
      return id
    },

    get(id: string): Promise<BrandClaimRow | null> {
      return db.prepare('SELECT * FROM brand_claims WHERE id = ?').bind(id).first<BrandClaimRow>()
    },

    /** Resolve a pending claim. Returns false if it was already resolved (or gone). */
    async resolve(id: string, status: 'verified' | 'rejected', by: string, now: string): Promise<boolean> {
      const res = await db
        .prepare("UPDATE brand_claims SET status=?, method='admin', resolved_by=?, resolved_at=? WHERE id=? AND status='pending'")
        .bind(status, by, now, id)
        .run()
      return res.meta.changes > 0
    },

    async listPending(limit: number): Promise<BrandClaimRow[]> {
      const rows = await db
        .prepare("SELECT * FROM brand_claims WHERE status='pending' ORDER BY created_at ASC LIMIT ?")
        .bind(limit)
        .all<BrandClaimRow>()
      return rows.results
    },

    async listByAccount(accountId: string, limit: number): Promise<BrandClaimRow[]> {
      const rows = await db
        .prepare('SELECT * FROM brand_claims WHERE account_id = ? ORDER BY created_at DESC LIMIT ?')
        .bind(accountId, limit)
        .all<BrandClaimRow>()
      return rows.results
    },
  }
}
