import { ulid } from '../lib/ulid'
import { createRolesStore } from './roles'
import { REQUIRED_APPROVALS } from './contributions'

export interface VariantRef {
  variant_id: string
  product_id: string
  brand_id: string | null
}

export interface PriceReportRow {
  id: string
  variant_id: string
  account_id: string
  mrp_paise: number
  source: string
  note: string
  status: string
  resolved_by: string
  resolved_at: string
  created_at: string
}

export interface PriceReportView {
  id: string
  variant_id: string
  account_id: string
  mrp_paise: number
  source: string
  note: string
  status: string
  approvals: number
  created_at: string
  resolved_at: string
}

export type SubmitPrice =
  | { status: 'applied'; report_id: string; mrp_paise: number }
  | { status: 'pending'; report_id: string; mrp_paise: number }

export type ApprovePrice =
  | { ok: false; reason: 'not_found' | 'already_resolved' | 'cannot_approve_own' }
  | { ok: true; status: 'pending'; approvals: number }
  | { ok: true; status: 'applied'; approvals: number; mrp_paise: number }

const toView = (r: PriceReportRow, approvals: number): PriceReportView => ({
  id: r.id, variant_id: r.variant_id, account_id: r.account_id, mrp_paise: r.mrp_paise,
  source: r.source, note: r.note, status: r.status, approvals, created_at: r.created_at, resolved_at: r.resolved_at,
})

export function createPricesStore(db: D1Database) {
  const roles = createRolesStore(db)

  /** Resolve a barcode to its variant + product + brand (null if unknown). */
  async function findVariant(barcode: string): Promise<VariantRef | null> {
    const row = await db
      .prepare('SELECT v.id AS variant_id, v.product_id AS product_id, p.brand_id AS brand_id FROM variants v JOIN products p ON p.id = v.product_id WHERE v.barcode = ?')
      .bind(barcode)
      .first<VariantRef>()
    return row
  }

  /** Set the variant's authoritative MRP + provenance. */
  async function applyPrice(variantId: string, mrpPaise: number, source: string, by: string, now: string): Promise<void> {
    await db
      .prepare('UPDATE variants SET mrp_paise=?, mrp_source=?, mrp_reported_by=?, mrp_updated_at=?, updated_at=? WHERE id=?')
      .bind(mrpPaise, source, by, now, now, variantId)
      .run()
  }

  async function countApprovals(reportId: string): Promise<number> {
    return (await db.prepare('SELECT COUNT(*) AS c FROM price_approvals WHERE report_id = ?').bind(reportId).first<{ c: number }>())!.c
  }

  const store = {
    findVariant,

    async submit(accountId: string, ref: VariantRef, mrpPaise: number, source: string, note: string, now: string): Promise<SubmitPrice> {
      const id = ulid()
      const ownerAuto = ref.brand_id !== null && (await roles.isVerifiedOwner(accountId, ref.brand_id))
      if (ownerAuto) {
        await applyPrice(ref.variant_id, mrpPaise, source, accountId, now)
        await db
          .prepare("INSERT INTO price_reports (id, variant_id, account_id, mrp_paise, source, note, status, resolved_by, resolved_at, created_at) VALUES (?, ?, ?, ?, ?, ?, 'applied', ?, ?, ?)")
          .bind(id, ref.variant_id, accountId, mrpPaise, source, note, accountId, now, now)
          .run()
        return { status: 'applied', report_id: id, mrp_paise: mrpPaise }
      }
      await db
        .prepare("INSERT INTO price_reports (id, variant_id, account_id, mrp_paise, source, note, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)")
        .bind(id, ref.variant_id, accountId, mrpPaise, source, note, now)
        .run()
      return { status: 'pending', report_id: id, mrp_paise: mrpPaise }
    },

    getRow(id: string): Promise<PriceReportRow | null> {
      return db.prepare('SELECT * FROM price_reports WHERE id = ?').bind(id).first<PriceReportRow>()
    },

    async get(id: string): Promise<PriceReportView | null> {
      const row = await store.getRow(id)
      if (!row) return null
      return toView(row, await countApprovals(id))
    },

    async approve(reportId: string, approverId: string, now: string): Promise<ApprovePrice> {
      const row = await store.getRow(reportId)
      if (!row) return { ok: false, reason: 'not_found' }
      if (row.status !== 'pending') return { ok: false, reason: 'already_resolved' }
      if (row.account_id === approverId) return { ok: false, reason: 'cannot_approve_own' }
      await db.prepare('INSERT OR IGNORE INTO price_approvals (report_id, account_id, created_at) VALUES (?, ?, ?)').bind(reportId, approverId, now).run()
      const approvals = await countApprovals(reportId)
      if (approvals < REQUIRED_APPROVALS) return { ok: true, status: 'pending', approvals }
      await applyPrice(row.variant_id, row.mrp_paise, row.source, approverId, now)
      await db.prepare("UPDATE price_reports SET status='applied', resolved_by=?, resolved_at=? WHERE id=?").bind(approverId, now, reportId).run()
      return { ok: true, status: 'applied', approvals, mrp_paise: row.mrp_paise }
    },

    async reject(reportId: string, byId: string, now: string): Promise<'ok' | 'not_found' | 'already_resolved'> {
      const row = await store.getRow(reportId)
      if (!row) return 'not_found'
      if (row.status !== 'pending') return 'already_resolved'
      await db.prepare("UPDATE price_reports SET status='rejected', resolved_by=?, resolved_at=? WHERE id=?").bind(byId, now, reportId).run()
      return 'ok'
    },

    async listPending(limit: number): Promise<PriceReportView[]> {
      const rows = await db
        .prepare("SELECT r.*, (SELECT COUNT(*) FROM price_approvals a WHERE a.report_id = r.id) AS approvals FROM price_reports r WHERE r.status = 'pending' ORDER BY r.created_at ASC LIMIT ?")
        .bind(limit)
        .all<PriceReportRow & { approvals: number }>()
      return rows.results.map((r) => toView(r, r.approvals))
    },

    async listByAccount(accountId: string, limit: number): Promise<PriceReportView[]> {
      const rows = await db
        .prepare("SELECT r.*, (SELECT COUNT(*) FROM price_approvals a WHERE a.report_id = r.id) AS approvals FROM price_reports r WHERE r.account_id = ? ORDER BY r.created_at DESC LIMIT ?")
        .bind(accountId, limit)
        .all<PriceReportRow & { approvals: number }>()
      return rows.results.map((r) => toView(r, r.approvals))
    },
  }
  return store
}
