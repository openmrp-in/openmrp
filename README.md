# OpenMRP

**Free, open product database for India.** Scan a barcode → product name, brand,
pack size, and the real **MRP** — in all 22 official Indian languages.
Community-built, brand-maintained, openly licensed.

🌐 [openmrp.in](https://openmrp.in) · 📦 Open data under ODbL-1.0 · 🇮🇳 22 languages

---

## What is OpenMRP?

OpenMRP is the **free, open alternative to GS1 DataKart and Smart Consumer** — a
public registry of Indian grocery / FMCG products keyed by barcode. Look up any
product to see its name, brand, image, pack sizes, **MRP**, veg/non-veg mark, HSN
code, and category — in your language.

- **For everyone** — scan a barcode, see the real MRP, know if you're being
  overcharged. Free, no login.
- **For brands** — register and maintain your own products **for free**, and own how
  your product appears across all 22 Indian languages on India's canonical product
  database. (GS1 DataKart charges ₹2.95L/yr; OpenMRP is free.)
- **For developers** — a free, open, ODbL-licensed dataset + public API. Build on it.

## What OpenMRP is — and isn't

We are **not** replacing GS1's barcodes. Brands keep their existing GS1 barcodes (the
global standard). OpenMRP is the **free, open data and verification layer** over those
barcodes — the part GS1 charges for.

| | |
|---|---|
| ✅ Free product-data registry (the "DataKart") | Brands register product info, free |
| ✅ Free consumer lookup (the "Smart Consumer") | Scan → name, brand, MRP, in 22 languages |
| ✅ Free brand verification | Via GS1's own public GEPIR registry |
| ❌ Barcode issuance | Stays with GS1 — brands keep their codes |

## 22 languages

Product names in all 22 languages of the Eighth Schedule of the Indian Constitution —
Hindi, Bengali, Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Punjabi, Odia,
Assamese, Urdu, and more. Brands provide official names; the community fills the rest;
machine translation seeds the gaps (always clearly marked as auto-translated).

## Open data

The dataset is published under the **Open Database License (ODbL 1.0)** — free to use,
share, and build on, with attribution and share-alike. Periodic open data dumps are
published openly (which also satisfies ODbL's share-alike obligation by design).

## Licensing

OpenMRP is openly licensed, in three layers:

| What | License |
|---|---|
| **Code** (this repo) | [Apache-2.0](LICENSE) |
| **Data** (the product database) | [ODbL-1.0](LICENSE-DATA) |
| **Media** (contributed images) | [CC-BY-SA-4.0](LICENSE-MEDIA) |

The ODbL data license is **irrevocable** — the data is, and always will be, open. See
[GOVERNANCE.md](GOVERNANCE.md).

## Contributing

- **Brands** — register to manage your own products and their 22-language names.
  _(Onboarding flow: coming soon.)_
- **Maintainers** — a small trusted team reviews community contributions. See
  [GOVERNANCE.md](GOVERNANCE.md).
- **Everyone** — suggest a product, correct a detail, or flag a wrong MRP.

## Repository structure

```
openmrp/
├── backend/    # API — Cloudflare Workers + D1 (TypeScript). Barcode resolve + write API.
├── frontend/   # Public site — Cloudflare Pages (Next.js/Astro). Coming soon.
└── dump/       # ODbL open-data exports (JSONL/CSV) + tooling. Coming soon.
```

Each folder is an independent project with its own `package.json`. See each folder's
README for status and details.

## Status

🚧 **Early / pre-build.** Identity and design are set; the platform is being built.
Planned architecture: Cloudflare Workers + D1 + R2 + Pages (TypeScript), with the open
dataset versioned here on GitHub. The `backend/` Phase 0 core (barcode resolve + admin
write + OFF fallback) is the first slice.

## Governance & stewardship

OpenMRP is stewarded by **Abitz Technologies Pvt. Ltd.**, with a commitment to being
irrevocably open — contributors trust the license, not the owner. See
[GOVERNANCE.md](GOVERNANCE.md).

---

_OpenMRP — know the real price._
