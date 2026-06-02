import { Hono } from 'hono'
import type { Env } from './env'
import productRoute from './routes/product'
import productsRoute from './routes/products'

const app = new Hono<{ Bindings: Env }>()

app.get('/health', (c) => c.json({ status: 'ok', service: 'openmrp-backend' }))

app.route('/v1/product', productRoute) // GET  /v1/product/:barcode
app.route('/v1/products', productsRoute) // POST /v1/products

app.notFound((c) => c.json({ error: 'not_found' }, 404))

export default app
