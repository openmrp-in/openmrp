-- Contributor-sourced MRP, with provenance.
--
-- The MRP printed on a pack is a public fact (mandated by the Legal Metrology Act
-- 2009), so reporting it is legitimate — PROVIDED it is read FROM THE PACK (or
-- submitted by the brand), never scraped from a commercial site's database. Each
-- report records its source; reports flow through the same moderation as edits:
-- a verified brand owner's report applies instantly, everyone else's needs two
-- approvals. The authoritative current MRP stays on variants.mrp_paise.

ALTER TABLE variants ADD COLUMN mrp_source TEXT NOT NULL DEFAULT '';      -- 'pack' | 'brand' | 'other'
ALTER TABLE variants ADD COLUMN mrp_reported_by TEXT NOT NULL DEFAULT ''; -- account id
ALTER TABLE variants ADD COLUMN mrp_updated_at TEXT NOT NULL DEFAULT '';

CREATE TABLE price_reports (
  id          TEXT PRIMARY KEY,
  variant_id  TEXT NOT NULL REFERENCES variants (id) ON DELETE CASCADE,
  account_id  TEXT NOT NULL REFERENCES developers (id) ON DELETE CASCADE,
  mrp_paise   INTEGER NOT NULL,
  source      TEXT NOT NULL DEFAULT 'pack',
  note        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'applied' | 'rejected'
  resolved_by TEXT NOT NULL DEFAULT '',
  resolved_at TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_price_reports_status ON price_reports (status, created_at);
CREATE INDEX idx_price_reports_account ON price_reports (account_id, created_at);
CREATE INDEX idx_price_reports_variant ON price_reports (variant_id);

CREATE TABLE price_approvals (
  report_id  TEXT NOT NULL REFERENCES price_reports (id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES developers (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (report_id, account_id)
);
