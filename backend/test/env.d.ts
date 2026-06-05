import type { D1Migration } from '@cloudflare/vitest-pool-workers/config'
import type { Env } from '../src/env'

declare module 'cloudflare:test' {
  // The test env is the app's Env (DB, ADMIN_KEY, JWT_SECRET, GEPIR_BASE_URL, DUMP)
  // plus the migrations blob applied in setup.
  interface ProvidedEnv extends Env {
    TEST_MIGRATIONS: D1Migration[]
  }
}
