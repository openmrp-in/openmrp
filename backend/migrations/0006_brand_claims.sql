-- Brand-ownership claims. An account claims a brand by proving it owns the GS1
-- prefix of one of the brand's GTINs; GEPIR auto-verifies the company match, and
-- anything it can't confirm waits for manual admin review.

CREATE TABLE brand_claims (
  id              TEXT PRIMARY KEY,
  account_id      TEXT NOT NULL REFERENCES developers (id) ON DELETE CASCADE,
  brand_id        TEXT NOT NULL REFERENCES brands (id) ON DELETE CASCADE,
  gtin            TEXT NOT NULL,
  claimed_company TEXT NOT NULL DEFAULT '',
  gepir_company   TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'verified' | 'rejected'
  method          TEXT NOT NULL DEFAULT 'gepir',   -- 'gepir' | 'admin'
  resolved_by     TEXT NOT NULL DEFAULT '',
  resolved_at     TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL
);
CREATE INDEX idx_brand_claims_status ON brand_claims (status, created_at);
CREATE INDEX idx_brand_claims_account ON brand_claims (account_id, created_at);
CREATE INDEX idx_brand_claims_brand ON brand_claims (brand_id);
