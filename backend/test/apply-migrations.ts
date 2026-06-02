import { applyD1Migrations, env } from 'cloudflare:test'

// Apply the app's D1 migrations to the isolated test database before each test file.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
