export interface DeveloperRow {
  id: string
  email: string
  password_hash: string
  name: string
  created_at: string
}

export interface ApiKeyRow {
  id: string
  developer_id: string
  prefix: string
  key_hash: string
  name: string
  revoked: number
  request_count: number
  last_used_at: string
  created_at: string
}

export interface DeveloperWithKeyCount extends DeveloperRow {
  key_count: number
}

/** D1-backed store for developer accounts + API keys. */
export function createAccountsStore(db: D1Database) {
  return {
    async createDeveloper(d: {
      id: string
      email: string
      passwordHash: string
      name: string
      now: string
    }): Promise<void> {
      await db
        .prepare('INSERT INTO developers (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(d.id, d.email, d.passwordHash, d.name, d.now)
        .run()
    },

    findDeveloperByEmail(email: string): Promise<DeveloperRow | null> {
      return db.prepare('SELECT * FROM developers WHERE lower(email) = lower(?)').bind(email).first<DeveloperRow>()
    },

    findDeveloperById(id: string): Promise<DeveloperRow | null> {
      return db.prepare('SELECT * FROM developers WHERE id = ?').bind(id).first<DeveloperRow>()
    },

    async createApiKey(k: {
      id: string
      developerId: string
      prefix: string
      keyHash: string
      name: string
      now: string
    }): Promise<void> {
      await db
        .prepare('INSERT INTO api_keys (id, developer_id, prefix, key_hash, name, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(k.id, k.developerId, k.prefix, k.keyHash, k.name, k.now)
        .run()
    },

    async listApiKeys(developerId: string): Promise<ApiKeyRow[]> {
      const rows = await db
        .prepare('SELECT * FROM api_keys WHERE developer_id = ? ORDER BY created_at DESC')
        .bind(developerId)
        .all<ApiKeyRow>()
      return rows.results
    },

    async revokeApiKey(id: string, developerId: string): Promise<boolean> {
      const res = await db
        .prepare('UPDATE api_keys SET revoked = 1 WHERE id = ? AND developer_id = ? AND revoked = 0')
        .bind(id, developerId)
        .run()
      return res.meta.changes > 0
    },

    async adminListDevelopers(limit: number): Promise<DeveloperWithKeyCount[]> {
      const rows = await db
        .prepare(
          'SELECT d.*, (SELECT COUNT(*) FROM api_keys k WHERE k.developer_id = d.id) AS key_count FROM developers d ORDER BY d.created_at DESC LIMIT ?',
        )
        .bind(limit)
        .all<DeveloperWithKeyCount>()
      return rows.results
    },

    async adminListKeys(limit: number): Promise<ApiKeyRow[]> {
      const rows = await db
        .prepare('SELECT * FROM api_keys ORDER BY created_at DESC LIMIT ?')
        .bind(limit)
        .all<ApiKeyRow>()
      return rows.results
    },
  }
}
