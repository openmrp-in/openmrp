-- OpenMRP — initial schema (Phase 0)
--
-- brands ──< products (family header) ──< variants (sellable unit; barcode + MRP)
--                                      └─< product_names (multilingual, 22 langs)
--
-- The barcode is the single lookup key and lives on `variants`.

CREATE TABLE brands (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL,
  manufacturer      TEXT NOT NULL DEFAULT '',
  source            TEXT NOT NULL DEFAULT 'crowd',      -- crowd|off|gs1|manual|invoice
  moderation_status TEXT NOT NULL DEFAULT 'approved',   -- pending|approved|rejected
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_brands_slug ON brands (slug);

CREATE TABLE products (
  id                TEXT PRIMARY KEY,
  brand_id          TEXT REFERENCES brands (id),
  name              TEXT NOT NULL,
  group_key         TEXT NOT NULL,
  image_url         TEXT NOT NULL DEFAULT '',
  hsn_code          TEXT NOT NULL DEFAULT '',
  category          TEXT NOT NULL DEFAULT '',
  food_type         TEXT NOT NULL DEFAULT 'none',       -- veg|non-veg|egg|none
  source            TEXT NOT NULL DEFAULT 'crowd',
  moderation_status TEXT NOT NULL DEFAULT 'pending',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX idx_products_brand ON products (brand_id);
CREATE INDEX idx_products_group_key ON products (group_key);

CREATE TABLE variants (
  id                TEXT PRIMARY KEY,
  product_id        TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  label             TEXT NOT NULL DEFAULT '',           -- "100g" / "1kg" ('' = single pack)
  pack_size         REAL NOT NULL DEFAULT 0,
  unit              TEXT NOT NULL DEFAULT '',
  barcode           TEXT NOT NULL DEFAULT '',
  mrp_paise         INTEGER NOT NULL DEFAULT 0,         -- money as integer paise
  source            TEXT NOT NULL DEFAULT 'crowd',
  moderation_status TEXT NOT NULL DEFAULT 'pending',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
-- THE lookup key: one product per non-empty barcode.
CREATE UNIQUE INDEX idx_variants_barcode ON variants (barcode) WHERE barcode <> '';
CREATE INDEX idx_variants_product ON variants (product_id);

CREATE TABLE product_names (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  lang        TEXT NOT NULL,                            -- BCP-47: en, hi, ta, kn, ...
  name        TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'crowd',            -- brand|crowd|machine|off
  verified    INTEGER NOT NULL DEFAULT 0,               -- 0/1
  created_at  TEXT NOT NULL,
  UNIQUE (product_id, lang)
);
