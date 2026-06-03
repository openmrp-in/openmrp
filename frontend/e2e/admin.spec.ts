import { test, expect } from '@playwright/test'

test('super-admin views developers and keys', async ({ page }) => {
  // ensure a developer exists
  const email = `e2e-admin-${Date.now()}@dev.com`
  await page.goto('/developers/register')
  await page.fill('#email', email)
  await page.fill('#password', 'password123')
  await page.click('button[type=submit]')
  await page.waitForURL(/\/developers\/dashboard/)

  await page.goto('/admin')
  await page.fill('#adminkey', 'local-dev-admin-key-change-me')
  await page.click('button[type=submit]')
  await expect(page.getByRole('heading', { name: /Developers/ })).toBeVisible()
  await expect(page.getByText(email)).toBeVisible()
})

test('super-admin rejects a wrong key', async ({ page }) => {
  await page.goto('/admin')
  await page.fill('#adminkey', 'definitely-wrong-key')
  await page.click('button[type=submit]')
  await expect(page.getByText('Invalid admin key')).toBeVisible()
})
