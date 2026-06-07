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
  request.post(`${API}/v1/products`, { headers: ADMIN, data: { brand: { name: `B-${barcode}` }, product: { name: 'PriceProd' }, variants: [{ label: '1pc', barcode }] } })
const useToken = (page: Page, token: string) => page.addInitScript((t) => localStorage.setItem('omrp_dev_token', t), token)
const approve = (request: APIRequestContext, token: string, id: string) =>
  request.post(`${API}/v1/prices/${id}/approve`, { headers: { Authorization: `Bearer ${token}` } })

test('report an MRP from the pack via the UI; it applies after two approvals', async ({ page, request }) => {
  const stamp = Date.now()
  const barcode = `7710${stamp}`.slice(0, 13)
  const author = await registerApi(request, `mrp-${stamp}@dev.com`)
  const r1 = await registerApi(request, `mr1-${stamp}@dev.com`)
  const r2 = await registerApi(request, `mr2-${stamp}@dev.com`)
  for (const a of [author, r1, r2]) await grant(request, a.id, 'contributor')
  await createProduct(request, barcode)

  // report through the contribute UI
  await useToken(page, author.token)
  await page.goto(`/contribute?barcode=${barcode}`)
  await expect(page.getByText('Report MRP — from the pack')).toBeVisible()
  await page.locator(`.mrp-in[data-barcode="${barcode}"]`).fill('45.50')
  await page.locator(`.mrp-report[data-barcode="${barcode}"]`).click()
  await expect(page.locator('#price-result')).toHaveText(/pending/i)

  // two distinct approvals (the author's own report → not self-approvable)
  const mine = (await (await request.get(`${API}/v1/prices/mine`, { headers: { Authorization: `Bearer ${author.token}` } })).json()) as { reports: { id: string }[] }
  const id = mine.reports[0].id
  await approve(request, r1.token, id)
  expect((await (await approve(request, r2.token, id)).json()) as { status: string }).toMatchObject({ status: 'applied' })

  // the MRP + its provenance now show on the public product page
  await page.goto(`/p/${barcode}`)
  await expect(page.locator('td.mrp')).toContainText('45.50')
  await expect(page.locator('td.mrp .src')).toContainText('from pack')
})

test('a reviewer sees pending MRP reports in the review queue', async ({ page, request }) => {
  const stamp = Date.now() + 1
  const barcode = `7711${stamp}`.slice(0, 13)
  const author = await registerApi(request, `mrpa-${stamp}@dev.com`)
  const reviewer = await registerApi(request, `mrpr-${stamp}@dev.com`)
  await grant(request, author.id, 'contributor')
  await grant(request, reviewer.id, 'contributor')
  await createProduct(request, barcode)
  const uniquePaise = 1000 + (stamp % 8999) // distinct ₹ so the card is findable in the shared queue
  await request.post(`${API}/v1/prices`, { headers: { Authorization: `Bearer ${author.token}` }, data: { barcode, mrp_paise: uniquePaise, source: 'pack' } })
  const rupees = `₹${(uniquePaise / 100).toFixed(2)}`

  await useToken(page, reviewer.token)
  await page.goto('/review')
  const card = page.locator('#prices .card', { hasText: rupees })
  await expect(card).toBeVisible()
  await card.locator('.p-approve').click()
  await expect(page.locator('#prices .card', { hasText: rupees })).toContainText('1 / 2 approvals')
})
