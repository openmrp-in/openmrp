import { test, expect, type APIRequestContext, type Page } from '@playwright/test'

const API = 'http://127.0.0.1:8787'
const ADMIN = { 'X-Admin-Key': 'local-dev-admin-key-change-me' }

async function registerApi(request: APIRequestContext, email: string): Promise<{ id: string; token: string }> {
  const r = await request.post(`${API}/v1/auth/register`, { data: { email, password: 'password123', name: email } })
  const b = (await r.json()) as { token: string; developer: { id: string } }
  return { id: b.developer.id, token: b.token }
}
const grant = (request: APIRequestContext, id: string, role: string) =>
  request.post(`${API}/v1/admin/accounts/${id}/roles`, { headers: ADMIN, data: { role } })
const createProduct = (request: APIRequestContext, barcode: string) =>
  request.post(`${API}/v1/products`, { headers: ADMIN, data: { brand: { name: `B-${barcode}` }, product: { name: 'Base' }, variants: [{ label: '1pc', barcode }] } })
const useToken = (page: Page, token: string) =>
  page.addInitScript((t) => localStorage.setItem('omrp_dev_token', t), token)

test('a contributor proposes an edit and sees it queued', async ({ page, request }) => {
  const stamp = Date.now()
  const barcode = `8700${stamp}`.slice(0, 13)
  const acc = await registerApi(request, `contrib-${stamp}@dev.com`)
  await grant(request, acc.id, 'contributor')
  await createProduct(request, barcode)

  await useToken(page, acc.token)
  await page.goto('/contribute')
  await page.fill('#barcode', barcode)
  await page.click('#load')
  await expect(page.locator('#f-name')).toBeVisible()
  await page.fill('#f-name', 'Edited By E2E')
  await page.click('#submit')

  await expect(page.locator('#result')).toHaveText(/pending/i)
  await expect(page.locator('#mine')).toContainText('pending')
})

test('the contribute page prefills from a barcode query param', async ({ page, request }) => {
  const stamp = Date.now() + 1
  const barcode = `8701${stamp}`.slice(0, 13)
  const acc = await registerApi(request, `prefill-${stamp}@dev.com`)
  await grant(request, acc.id, 'contributor')
  await createProduct(request, barcode)

  await useToken(page, acc.token)
  await page.goto(`/contribute?barcode=${barcode}`)
  await expect(page.locator('#f-name')).toHaveValue('Base')
})
