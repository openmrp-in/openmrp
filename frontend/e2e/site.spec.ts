import { test, expect } from '@playwright/test'

const API = 'http://127.0.0.1:8787'
const ADMIN = 'local-dev-admin-key-change-me'

// Seed deterministic products so the assertions don't depend on prior data.
test.beforeAll(async ({ request }) => {
  await request.post(`${API}/v1/products/bulk`, {
    headers: { 'X-Admin-Key': ADMIN },
    data: { items: [{ barcode: '7000000000007', name: 'E2E Test Biscuit', brand: 'E2EBrand' }] },
  })
  await request.post(`${API}/v1/products`, {
    headers: { 'X-Admin-Key': ADMIN },
    data: {
      brand: { name: 'MLBrand' },
      product: { name: 'ML E2E', food_type: 'veg', description: 'English desc' },
      variants: [{ label: '100g', barcode: '7100000099999', mrp_paise: 2000 }],
      translations: [{ lang: 'ta', name: 'எம்எல்', description: 'தமிழ்' }],
    },
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

test('product page renders the default language with a native-script language tab', async ({ page }) => {
  await page.goto('/p/7100000099999')
  await expect(page.getByRole('heading', { name: 'ML E2E' })).toBeVisible()
  await expect(page.getByText('English desc')).toBeVisible()
  // the tab is labelled with the Tamil endonym, not the code
  await expect(page.getByRole('link', { name: 'தமிழ்' })).toBeVisible()
})

test('product page switches to Tamil via ?lang with a provenance badge', async ({ page }) => {
  await page.goto('/p/7100000099999?lang=ta')
  await expect(page.getByRole('heading', { name: 'எம்எல்' })).toBeVisible()
  await expect(page.locator('.desc')).toContainText('தமிழ்') // the translated description
  await expect(page.locator('.prov')).toContainText('Translation') // provenance shown
})
