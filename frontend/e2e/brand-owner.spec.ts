import { test, expect, type APIRequestContext, type Page } from '@playwright/test'

const API = 'http://127.0.0.1:8787'
const ADMIN = { 'X-Admin-Key': 'local-dev-admin-key-change-me' }

async function registerApi(request: APIRequestContext, email: string): Promise<{ id: string; token: string }> {
  const r = await request.post(`${API}/v1/auth/register`, { data: { email, password: 'password123', name: email } })
  const b = (await r.json()) as { token: string; developer: { id: string } }
  return { id: b.developer.id, token: b.token }
}
async function createProductSlug(request: APIRequestContext, barcode: string): Promise<string> {
  const r = await request.post(`${API}/v1/products`, { headers: ADMIN, data: { brand: { name: `B-${barcode}` }, product: { name: 'Base' }, variants: [{ label: '1pc', barcode }] } })
  return ((await r.json()) as { brand: { slug: string } }).brand.slug
}
const useToken = (page: Page, token: string) => page.addInitScript((t) => localStorage.setItem('omrp_dev_token', t), token)

test('a brand claim goes to review when GEPIR is unconfigured', async ({ page, request }) => {
  const stamp = Date.now() + 10
  const barcode = `8703${stamp}`.slice(0, 13)
  const acc = await registerApi(request, `bo-${stamp}@dev.com`)
  const slug = await createProductSlug(request, barcode)

  await useToken(page, acc.token)
  await page.goto('/brand-owner')
  await page.fill('#slug', slug)
  await page.fill('#gtin', barcode)
  await page.fill('#company', 'Acme Foods')
  await page.click('#claim')

  await expect(page.locator('#result')).toHaveText(/pending/i)
  await expect(page.locator('#claims')).toContainText('pending')
})

test('an unknown brand slug is reported', async ({ page, request }) => {
  const stamp = Date.now() + 14
  const acc = await registerApi(request, `bo2-${stamp}@dev.com`)
  await useToken(page, acc.token)
  await page.goto('/brand-owner')
  await page.fill('#slug', 'definitely-not-a-brand')
  await page.fill('#gtin', '89010000')
  await page.fill('#company', 'Nobody')
  await page.click('#claim')
  await expect(page.locator('#result')).toHaveText(/No brand with that slug/i)
})
