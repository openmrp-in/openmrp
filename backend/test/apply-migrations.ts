import { applyD1Migrations, env } from 'cloudflare:test'

// Apply the app's D1 migrations to the isolated test database before each test file.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)

// Seed a fixed developer + API key so read-endpoint tests can authenticate.
// Key: omrp_live_devkeyprefix.dev0000…  (SHA-256 of the secret is precomputed below)
await env.DB.prepare('INSERT OR IGNORE INTO developers (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)')
  .bind('dev-fixed', 'fixed@test', 'x', 'Fixed', '2026-01-01T00:00:00.000Z')
  .run()
await env.DB.prepare(
  'INSERT OR IGNORE INTO api_keys (id, developer_id, prefix, key_hash, name, created_at) VALUES (?, ?, ?, ?, ?, ?)',
)
  .bind(
    'key-fixed',
    'dev-fixed',
    'devkeyprefix',
    '75f788d955e4a866b5955a07ce6f4238f822c89c63ed4516401598f890290942',
    'test',
    '2026-01-01T00:00:00.000Z',
  )
  .run()
