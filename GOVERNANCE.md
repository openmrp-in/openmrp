# Governance

OpenMRP is an open, community product database for India. This document explains how
it's run, who decides what, and — most importantly — the commitments that make "open"
something you can rely on.

## The open commitment (irrevocable)

The OpenMRP dataset is licensed under the **Open Database License (ODbL 1.0)**. This is
**irrevocable**: the data is open and will always remain open. No owner, steward, or
future change of control can re-license the *existing* open dataset into a closed
product. Contributors and brands can rely on the license — not on trusting any single
party.

- **Data** → [ODbL-1.0](LICENSE-DATA) (open · attribution · share-alike)
- **Code** → [Apache-2.0](LICENSE)
- **Media** → [CC-BY-SA-4.0](LICENSE-MEDIA)

We publish periodic open data dumps so the dataset is always retrievable by anyone —
which also satisfies ODbL's share-alike obligation by design.

## Stewardship

OpenMRP is currently stewarded and administered by **Abitz Technologies Pvt. Ltd.**
Stewardship means operating the infrastructure, appointing maintainers, and guiding
direction — **not** owning the data (the data is openly licensed, see above).

**Intent:** if and when OpenMRP reaches a scale and community comparable to
OpenFoodFacts or OpenStreetMap, we intend to move stewardship to a neutral foundation.
Until then, the irrevocable open license is the guarantee.

## Roles

- **Public** — anyone. Read the data freely; suggest new products, corrections, or
  flag a wrong MRP. Suggestions enter the review queue (never auto-published).
- **Brand** — a verified product owner. Manages its own products: official names in all
  22 languages, MRP, images, pack variants. A brand's edits to its *own* products are
  trusted (auto-approved). Brand verification is **free**, primarily via GS1's public
  **GEPIR** registry, with a domain-email / GST fallback.
- **Maintainer** — a small, trusted team that reviews and approves community
  contributions and edits to brand products. Modeled on the trusted-editor approach of
  Wikipedia / OpenStreetMap.
- **Admin** — manages maintainers and brand verification; operates the platform.

## Becoming a maintainer

Maintainers are **invite-only** at this early stage — appointed by admins from trusted,
knowledgeable contributors (including experienced retailers who genuinely know products
and MRPs). As the community grows, we intend to add a **graduated path** where
consistent, high-quality contributors can earn maintainer status.

If you'd like to help maintain OpenMRP, open an issue or reach out via
[openmrp.in](https://openmrp.in).

## How decisions are made

- **Data quality** — governed by the provenance model: brand-official > human-verified
  community > machine-translation seed (always flagged). Conflicts go to maintainer
  review, not silent overwrite.
- **Direction & policy** — currently decided by the steward (Abitz) with community input
  via issues. Major changes are discussed openly.

## What we will not do

- We will **not** re-license the open dataset into a closed product (the ODbL forbids
  it, and so do we).
- We will **not** scrape copyrighted sources or marketplace sites. Data comes from
  brands, the community, purchase invoices, and open-licensed sources (e.g. Open Food
  Facts, with attribution) only.
- We will **not** sell or publicly expose contributor / brand personal data
  (verification documents, emails, GST records) — only the product *facts* are open.

---

_Questions? Open an issue or visit [openmrp.in](https://openmrp.in)._
