import { test, expect, type APIRequestContext, type Page } from '@playwright/test'

const API = 'http://127.0.0.1:8787'
const ADMIN_KEY = 'local-dev-admin-key-change-me'
const ADMIN = { 'X-Admin-Key': ADMIN_KEY }

async function registerApi(request: APIRequestContext, email: string): Promise<{ id: string; token: string }> {
  const r = await request.post(`${API}/v1/auth/register`, { data: { email, password: 'password123', name: email } })
  const b = (await r.json()) as { token: string; developer: { id: string } }
  return { id: b.developer.id, token: b.token }
}
async function createProductSlug(request: APIRequestContext, barcode: string): Promise<string> {
  const r = await request.post(`${API}/v1/products`, { headers: ADMIN, data: { brand: { name: `B-${barcode}` }, product: { name: 'Base' }, variants: [{ label: '1pc', barcode }] } })
  return ((await r.json()) as { brand: { slug: string } }).brand.slug
}
async function openAdmin(page: Page) {
  await page.goto('/admin')
  await page.fill('#adminkey', ADMIN_KEY)
  await page.click('#gateform button')
}

test('super-admin approves a pending brand claim', async ({ page, request }) => {
  const stamp = Date.now() + 11
  const barcode = `8704${stamp}`.slice(0, 13)
  const acc = await registerApi(request, `claimer-${stamp}@dev.com`)
  const slug = await createProductSlug(request, barcode)
  await request.post(`${API}/v1/brand-claims`, { headers: { Authorization: `Bearer ${acc.token}` }, data: { slug, gtin: barcode, company: 'Acme' } })

  await openAdmin(page)
  const card = page.locator('#claims .card', { hasText: barcode })
  await expect(card).toBeVisible()
  await card.locator('.capprove').click()
  await expect(page.locator('#claims .card', { hasText: barcode })).toHaveCount(0) // approved → left the queue
})

test('super-admin grants a role to an account', async ({ page, request }) => {
  const stamp = Date.now() + 12
  const acc = await registerApi(request, `roleacc-${stamp}@dev.com`)
  await openAdmin(page)
  await page.fill('#role-acc', acc.id)
  await page.click('#role-grant')
  await expect(page.locator('#role-result')).toHaveText(/Contributor/)
})

test('super-admin loads a product version history', async ({ page, request }) => {
  const stamp = Date.now() + 13
  const barcode = `8705${stamp}`.slice(0, 13)
  await createProductSlug(request, barcode) // admin create snapshots v1 'create'
  await openAdmin(page)
  await page.fill('#ver-barcode', barcode)
  await page.click('#ver-load')
  await expect(page.locator('#versions')).toContainText('v1 — create')
})
