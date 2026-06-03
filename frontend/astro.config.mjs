import { defineConfig } from 'astro/config'
import cloudflare from '@astrojs/cloudflare'

// Public site: SSR product pages on Cloudflare Pages. Zero client JS by default —
// SEO + Core Web Vitals first (the whole point of a canonical indexed reference).
export default defineConfig({
  site: 'https://openmrp.in',
  output: 'server',
  adapter: cloudflare(),
})
