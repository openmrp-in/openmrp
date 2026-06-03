-- Multilingual depth: descriptions + ingredients as fields, and per-(entity, lang)
-- translation tables so EVERY text field (product name/description/ingredients,
-- brand name/description) is translatable into all 22 Indian languages.
-- Base rows hold the canonical/default value; translation rows layer per language.

ALTER TABLE products ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN ingredients TEXT NOT NULL DEFAULT '';
ALTER TABLE brands ADD COLUMN description TEXT NOT NULL DEFAULT '';

-- product_names held only the name per language — generalize it to all product text.
ALTER TABLE product_names RENAME TO product_translations;
ALTER TABLE product_translations ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE product_translations ADD COLUMN ingredients TEXT NOT NULL DEFAULT '';

CREATE TABLE brand_translations (
  id          TEXT PRIMARY KEY,
  brand_id    TEXT NOT NULL REFERENCES brands (id) ON DELETE CASCADE,
  lang        TEXT NOT NULL,                  -- BCP-47: en, hi, ta, kn, ...
  name        TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  source      TEXT NOT NULL DEFAULT 'crowd',  -- brand|crowd|machine|off
  verified    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  UNIQUE (brand_id, lang)
);
