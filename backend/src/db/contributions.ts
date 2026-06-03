import { ulid } from '../lib/ulid'
import { createRolesStore } from './roles'
import { applyProductEdit, countVersions, snapshotVersion, type ProductEdit } from './versions'

/** A community change to a product clears once it has this many approvals. */
export const REQUIRED_APPROVALS = 2

export interface ContributionRow {
  id: string
  account_id: string
  product_id: string
  kind: string
  payload: string
  note: string
  status: string
  applied_version: number | null
  resolved_by: string
  resolved_at: string
  created_at: string
}

export interface ContributionView {
  id: string
  account_id: string
  product_id: string
  kind: string
  note: string
  status: string
  applied_version: number | null
  approvals: number
  created_at: string
  resolved_at: string
}

export type SubmitResult =
  | { status: 'applied'; contribution_id: string; version: number }
  | { status: 'pending'; contribution_id: string }

export type ApproveResult =
  | { ok: false; reason: 'not_found' | 'already_resolved' | 'cannot_approve_own' }
  | { ok: true; status: 'pending'; approvals: number }
  | { ok: true; status: 'applied'; approvals: number; version: number }

function toView(row: ContributionRow, approvals: number): ContributionView {
  return {
    id: row.id,
    account_id: row.account_id,
    product_id: row.product_id,
    kind: row.kind,
    note: row.note,
    status: row.status,
    applied_version: row.applied_version,
    approvals,
    created_at: row.created_at,
    resolved_at: row.resolved_at,
  }
}

/** Snapshot a baseline (if none yet), apply the edit, then version it. Returns the new version. */
async function applyAndVersion(
  db: D1Database,
  productId: string,
  edit: ProductEdit,
  note: string,
  by: string,
  now: string,
): Promise<number> {
  if ((await countVersions(db, productId)) === 0) await snapshotVersion(db, productId, 'baseline', by, now)
  await applyProductEdit(db, productId, edit, now)
  return snapshotVersion(db, productId, note, by, now)
}

export function createContributionsStore(db: D1Database) {
  const roles = createRolesStore(db)

  async function countApprovals(contributionId: string): Promise<number> {
    return (
      await db
        .prepare('SELECT COUNT(*) AS c FROM contribution_approvals WHERE contribution_id = ?')
        .bind(contributionId)
        .first<{ c: number }>()
    )!.c
  }

  async function markApplied(id: string, version: number, by: string, now: string): Promise<void> {
    await db
      .prepare("UPDATE contributions SET status='applied', applied_version=?, resolved_by=?, resolved_at=? WHERE id=?")
      .bind(version, by, now, id)
      .run()
  }

  return {
    /**
     * Submit a full-replace edit. Auto-applies (and versions) when the author is a
     * verified owner of the product's brand; otherwise queues it for 2 approvals.
     */
    async submit(
      accountId: string,
      productId: string,
      brandId: string | null,
      edit: ProductEdit,
      note: string,
      now: string,
    ): Promise<SubmitResult> {
      const id = ulid()
      const ownerAuto = brandId !== null && (await roles.isVerifiedOwner(accountId, brandId))
      if (ownerAuto) {
        const version = await applyAndVersion(db, productId, edit, 'edit by brand owner', accountId, now)
        await db
          .prepare(
            "INSERT INTO contributions (id, account_id, product_id, kind, payload, note, status, applied_version, resolved_by, resolved_at, created_at) " +
              "VALUES (?, ?, ?, 'edit', ?, ?, 'applied', ?, ?, ?, ?)",
          )
          .bind(id, accountId, productId, JSON.stringify(edit), note, version, accountId, now, now)
          .run()
        return { status: 'applied', contribution_id: id, version }
      }
      await db
        .prepare(
          "INSERT INTO contributions (id, account_id, product_id, kind, payload, note, status, created_at) " +
            "VALUES (?, ?, ?, 'edit', ?, ?, 'pending', ?)",
        )
        .bind(id, accountId, productId, JSON.stringify(edit), note, now)
        .run()
      return { status: 'pending', contribution_id: id }
    },

    getRow(id: string): Promise<ContributionRow | null> {
      return db.prepare('SELECT * FROM contributions WHERE id = ?').bind(id).first<ContributionRow>()
    },

    async get(id: string): Promise<ContributionView | null> {
      const row = await this.getRow(id)
      if (!row) return null
      return toView(row, await countApprovals(id))
    },

    /** Record an approval; applies the change once REQUIRED_APPROVALS distinct accounts approve. */
    async approve(contributionId: string, approverId: string, now: string): Promise<ApproveResult> {
      const row = await this.getRow(contributionId)
      if (!row) return { ok: false, reason: 'not_found' }
      if (row.status !== 'pending') return { ok: false, reason: 'already_resolved' }
      if (row.account_id === approverId) return { ok: false, reason: 'cannot_approve_own' }

      await db
        .prepare('INSERT OR IGNORE INTO contribution_approvals (contribution_id, account_id, created_at) VALUES (?, ?, ?)')
        .bind(contributionId, approverId, now)
        .run()
      const approvals = await countApprovals(contributionId)
      if (approvals < REQUIRED_APPROVALS) return { ok: true, status: 'pending', approvals }

      const edit = JSON.parse(row.payload) as ProductEdit
      const version = await applyAndVersion(db, row.product_id, edit, 'community edit', approverId, now)
      await markApplied(contributionId, version, approverId, now)
      return { ok: true, status: 'applied', approvals, version }
    },

    /** Reject (admin) or withdraw (author) a pending contribution. */
    async reject(contributionId: string, byId: string, now: string): Promise<'ok' | 'not_found' | 'already_resolved'> {
      const row = await this.getRow(contributionId)
      if (!row) return 'not_found'
      if (row.status !== 'pending') return 'already_resolved'
      await db
        .prepare("UPDATE contributions SET status='rejected', resolved_by=?, resolved_at=? WHERE id=?")
        .bind(byId, now, contributionId)
        .run()
      return 'ok'
    },

    async listPending(limit: number): Promise<ContributionView[]> {
      const rows = await db
        .prepare(
          "SELECT c.*, (SELECT COUNT(*) FROM contribution_approvals a WHERE a.contribution_id = c.id) AS approvals " +
            "FROM contributions c WHERE c.status = 'pending' ORDER BY c.created_at ASC LIMIT ?",
        )
        .bind(limit)
        .all<ContributionRow & { approvals: number }>()
      return rows.results.map((r) => toView(r, r.approvals))
    },

    async listByAccount(accountId: string, limit: number): Promise<ContributionView[]> {
      const rows = await db
        .prepare(
          "SELECT c.*, (SELECT COUNT(*) FROM contribution_approvals a WHERE a.contribution_id = c.id) AS approvals " +
            "FROM contributions c WHERE c.account_id = ? ORDER BY c.created_at DESC LIMIT ?",
        )
        .bind(accountId, limit)
        .all<ContributionRow & { approvals: number }>()
      return rows.results.map((r) => toView(r, r.approvals))
    },
  }
}
