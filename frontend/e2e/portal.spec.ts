import { test, expect } from '@playwright/test'

test('register, create an API key, then revoke it', async ({ page }) => {
  const email = `e2e-${Date.now()}@dev.com`
  await page.goto('/developers/register')
  await page.fill('#email', email)
  await page.fill('#password', 'password123')
  await page.click('button[type=submit]')
  await page.waitForURL(/\/developers\/dashboard/)
  await expect(page.getByText(email)).toBeVisible()
  await expect(page.getByText('No keys yet', { exact: false })).toBeVisible()

  // create + revoke both use native dialogs (prompt / confirm)
  page.on('dialog', (d) => d.accept('e2e-key'))
  await page.click('#create')
  await expect(page.locator('.newkey')).toContainText('omrp_live_')
  await expect(page.getByRole('cell', { name: 'e2e-key' })).toBeVisible()

  await page.click('.revoke')
  await expect(page.locator('.chip', { hasText: 'revoked' })).toBeVisible()
})

test('log out and back in', async ({ page }) => {
  const email = `e2e-login-${Date.now()}@dev.com`
  await page.goto('/developers/register')
  await page.fill('#email', email)
  await page.fill('#password', 'password123')
  await page.click('button[type=submit]')
  await page.waitForURL(/\/developers\/dashboard/)

  await page.click('#logout')
  await page.waitForURL(/\/developers\/login/)
  await page.fill('#email', email)
  await page.fill('#password', 'password123')
  await page.click('button[type=submit]')
  await page.waitForURL(/\/developers\/dashboard/)
  await expect(page.getByText(email)).toBeVisible()
})
