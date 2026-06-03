import { test, expect } from '@playwright/test'

const API = 'http://127.0.0.1:8787'
const ADMIN = 'local-dev-admin-key-change-me'

// Seed a deterministic product so the assertions don't depend on prior data.
test.beforeAll(async ({ request }) => {
  await request.post(`${API}/v1/products/bulk`, {
    headers: { 'X-Admin-Key': ADMIN },
    data: { items: [{ barcode: '7000000000007', name: 'E2E Test Biscuit', brand: 'E2EBrand' }] },
  })
})

test('home page shows the search form', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /real MRP/i })).toBeVisible()
  await expect(page.locator('input[name="q"]')).toBeVisible()
})

test('product page renders a seeded product', async ({ page }) => {
  await page.goto('/p/7000000000007')
  await expect(page.getByRole('heading', { name: 'E2E Test Biscuit' })).toBeVisible()
  await expect(page.getByText(/Pack sizes/i)).toBeVisible()
})

test('search by name shows results', async ({ page }) => {
  await page.goto('/search?q=E2E')
  await expect(page.getByText('E2E Test Biscuit')).toBeVisible()
})

test('search with a barcode redirects to the product page', async ({ page }) => {
  await page.goto('/search?q=7000000000007')
  await expect(page).toHaveURL(/\/p\/7000000000007$/)
  await expect(page.getByRole('heading', { name: 'E2E Test Biscuit' })).toBeVisible()
})

test('brands page lists brands', async ({ page }) => {
  await page.goto('/brands')
  await expect(page.getByRole('heading', { name: 'Brands' })).toBeVisible()
  await expect(page.getByText('E2EBrand')).toBeVisible()
})

test('brand page lists its products', async ({ page }) => {
  await page.goto('/brand/e2ebrand')
  await expect(page.getByText('E2E Test Biscuit')).toBeVisible()
})
