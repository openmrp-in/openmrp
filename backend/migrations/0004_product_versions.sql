-- Per-product version history. Every applied change snapshots the full product
-- (product + brand + variants + translations) as JSON, so any product can be
-- reverted to a previous stable version.

CREATE TABLE product_versions (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  version     INTEGER NOT NULL,          -- 1-based, increments per product
  snapshot    TEXT NOT NULL,             -- JSON: { product, brand, variants, translations, brand_translations }
  note        TEXT NOT NULL DEFAULT '',  -- what changed (e.g. "create", "edit", "revert to v2")
  created_by  TEXT NOT NULL DEFAULT '',  -- account id or 'admin'
  created_at  TEXT NOT NULL,
  UNIQUE (product_id, version)
);
CREATE INDEX idx_product_versions_product ON product_versions (product_id, version DESC);
