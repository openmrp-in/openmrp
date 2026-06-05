import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config'
import { fileURLToPath } from 'node:url'

export default defineWorkersConfig(async () => {
  // Read the same migrations the app ships, applied to the test D1 in setup.
  const migrationsDir = fileURLToPath(new URL('./migrations', import.meta.url))
  const migrations = await readD1Migrations(migrationsDir)

  return {
    test: {
      include: ['test/**/*.test.ts'],
      setupFiles: ['./test/apply-migrations.ts'],
      poolOptions: {
        workers: {
          singleWorker: true,
          wrangler: { configPath: './wrangler.toml' },
          miniflare: {
            // Bindings used by tests: the admin key + the migrations blob.
            bindings: {
              ADMIN_KEY: 'test-admin-key',
              JWT_SECRET: 'test-jwt-secret',
              GEPIR_BASE_URL: 'https://gepir.test',
              TEST_MIGRATIONS: migrations,
            },
            r2Buckets: ['DUMP'],
          },
        },
      },
      coverage: {
        provider: 'istanbul', // workerd has no v8 coverage profiler — istanbul required
        include: ['src/**/*.ts'],
        reporter: ['text', 'json-summary'],
        thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
      },
    },
  }
})
