import { test, expect } from '@playwright/test'

const API = 'http://127.0.0.1:8787'
const ADMIN = { 'X-Admin-Key': 'local-dev-admin-key-change-me' }

test('publishes a dump and the downloads page lists it', async ({ page, request }) => {
  const barcode = `8809${Date.now()}`.slice(0, 13)
  await request.post(`${API}/v1/products`, {
    headers: { ...ADMIN, 'content-type': 'application/json' },
    data: { brand: { name: 'DumpCo' }, product: { name: 'DumpProd' }, variants: [{ label: '1pc', barcode }] },
  })
  const trig = await request.post(`${API}/v1/admin/dump`, { headers: ADMIN })
  expect(trig.ok()).toBeTruthy()

  await page.goto('/downloads')
  await expect(page.getByRole('heading', { name: 'Download the dataset' })).toBeVisible()
  await expect(page.getByText('ODbL-1.0')).toBeVisible()
  await expect(page.getByRole('link', { name: 'products.csv' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'openmrp.sql' })).toBeVisible()

  // the download link actually serves the file
  const csv = await request.get(`${API}/v1/dump/file/products.csv`)
  expect(csv.status()).toBe(200)
  expect(await csv.text()).toContain('DumpProd')
})
