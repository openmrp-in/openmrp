import { defineConfig, devices } from '@playwright/test'

// E2E: boots the backend (migrated local D1) + the Astro site, then drives a browser.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4321' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command:
        'CI=1 npm --prefix ../backend run db:migrate:local && npm --prefix ../backend run dev -- --port 8787 --ip 127.0.0.1',
      url: 'http://127.0.0.1:8787/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --port 4321 --host 127.0.0.1',
      url: 'http://127.0.0.1:4321',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
