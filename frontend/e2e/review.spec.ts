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

test('a reviewer sees the queue and records an approval', async ({ page, request }) => {
  const stamp = Date.now() + 2
  const barcode = `8702${stamp}`.slice(0, 13)
  const author = await registerApi(request, `author-${stamp}@dev.com`)
  const reviewer = await registerApi(request, `reviewer-${stamp}@dev.com`)
  await grant(request, author.id, 'contributor')
  await grant(request, reviewer.id, 'contributor')
  await createProduct(request, barcode)
  await request.post(`${API}/v1/contributions`, {
    headers: { Authorization: `Bearer ${author.token}` },
    data: { barcode, edit: { name: 'Proposed Name' }, note: 'e2e-review-note' },
  })

  await useToken(page, reviewer.token)
  await page.goto('/review')
  await expect(page.getByText('e2e-review-note')).toBeVisible()
  await page.locator('.approve').first().click()
  // one approval of two — the item stays pending, now showing 1 / 2
  await expect(page.getByText('1 / 2 approvals')).toBeVisible()
})

test('a non-reviewer is told they lack the role', async ({ page, request }) => {
  const stamp = Date.now() + 3
  const acc = await registerApi(request, `plain-${stamp}@dev.com`)
  await useToken(page, acc.token)
  await page.goto('/review')
  await expect(page.getByText(/contributor or admin role/i)).toBeVisible()
})
