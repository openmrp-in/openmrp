import { test, expect, type APIRequestContext, type Page } from '@playwright/test'

const API = 'http://127.0.0.1:8787'
const ADMIN = { 'X-Admin-Key': 'local-dev-admin-key-change-me' }

async function registerApi(request: APIRequestContext, email: string): Promise<{ id: string; token: string }> {
  const r = await request.post(`${API}/v1/auth/register`, { data: { email, password: 'password123', name: email } })
  const b = (await r.json()) as { token: string; developer: { id: string } }
  return { id: b.developer.id, token: b.token }
}
async function createBrand(request: APIRequestContext, name: string, barcode: string): Promise<{ brandId: string; slug: string }> {
  const r = await request.post(`${API}/v1/products`, { headers: ADMIN, data: { brand: { name }, product: { name: `${name} seed` }, variants: [{ label: '1pc', barcode }] } })
  const b = (await r.json()) as { brand: { id: string; slug: string } }
  return { brandId: b.brand.id, slug: b.brand.slug }
}
const grantOwner = (request: APIRequestContext, account_id: string, brand_id: string) =>
  request.post(`${API}/v1/admin/brand-owners`, { headers: ADMIN, data: { account_id, brand_id } })
const useToken = (page: Page, token: string) => page.addInitScript((t) => localStorage.setItem('omrp_dev_token', t), token)

test('a verified owner uploads a catalog CSV and the products + MRP go live', async ({ page, request }) => {
  const stamp = Date.now()
  const owner = await registerApi(request, `brandcat-${stamp}@dev.com`)
  const { brandId, slug } = await createBrand(request, `Cat${stamp}`, `7950${stamp}`.slice(0, 13))
  await grantOwner(request, owner.id, brandId)
  const b1 = `7951${stamp}`.slice(0, 13)
  const b2 = `7952${stamp}`.slice(0, 13)
  const csv = `barcode,name,mrp,pack,category,food_type\n${b1},Cat Chips,20.00,100g,Snacks,veg\n${b2},Cat Cola,40,500ml,Beverages,veg\n`

  await useToken(page, owner.token)
  await page.goto('/brand-owner')
  await page.fill('#cat-slug', slug)
  await page.locator('#cat-file').setInputFiles({ name: 'catalog.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.click('#cat-upload')
  await expect(page.locator('#cat-result')).toHaveText(/2 created.*2 priced/)

  // applied live: searchable + priced with source=brand
  const res = (await (await request.get(`${API}/v1/product/${b1}`, { headers: { 'X-Api-Key': 'omrp_live_devkeyprefix.dev0000000000000000000000000000000000000000000000' } })).json()) as {
    product: { name: string; category: string }
    variants: { mrp_paise: number; mrp_source: string }[]
  }
  expect(res.product).toMatchObject({ name: 'Cat Chips', category: 'Snacks' })
  expect(res.variants[0]).toMatchObject({ mrp_paise: 2000, mrp_source: 'brand' })
})

test('a non-owner is refused', async ({ page, request }) => {
  const stamp = Date.now() + 1
  const stranger = await registerApi(request, `stranger-${stamp}@dev.com`)
  const { slug } = await createBrand(request, `Owned${stamp}`, `7953${stamp}`.slice(0, 13))
  await useToken(page, stranger.token)
  await page.goto('/brand-owner')
  await page.fill('#cat-slug', slug)
  await page.locator('#cat-file').setInputFiles({ name: 'c.csv', mimeType: 'text/csv', buffer: Buffer.from(`barcode,name,mrp\n7954${stamp},x,10\n`.slice(0, 200)) })
  await page.click('#cat-upload')
  await expect(page.locator('#cat-result')).toHaveText(/not a verified owner/i)
})
