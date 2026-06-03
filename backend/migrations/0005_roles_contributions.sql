-- Multi-role accounts + community contributions + the 2-approval engine.
--
-- Every account (a row in `developers`) can hold several additive roles. A change
-- to a product is a `contribution`: it auto-applies when its author is a verified
-- brand owner of the product's brand, otherwise it waits for 2 approvals from
-- other accounts before being applied (and versioned via product_versions).

CREATE TABLE account_roles (
  account_id TEXT NOT NULL REFERENCES developers (id) ON DELETE CASCADE,
  role       TEXT NOT NULL,                  -- 'contributor' | 'brand_owner' | 'admin'
  granted_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  PRIMARY KEY (account_id, role)
);

-- Verified ownership of a brand by an account (admin-granted now; GEPIR later).
CREATE TABLE brand_owners (
  account_id TEXT NOT NULL REFERENCES developers (id) ON DELETE CASCADE,
  brand_id   TEXT NOT NULL REFERENCES brands (id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'verified', -- 'pending' | 'verified'
  method     TEXT NOT NULL DEFAULT 'admin',    -- 'admin' | 'gepir'
  created_at TEXT NOT NULL,
  PRIMARY KEY (account_id, brand_id)
);
CREATE INDEX idx_brand_owners_brand ON brand_owners (brand_id);

-- A proposed full-replace edit to a product.
CREATE TABLE contributions (
  id              TEXT PRIMARY KEY,
  account_id      TEXT NOT NULL REFERENCES developers (id) ON DELETE CASCADE,
  product_id      TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  kind            TEXT NOT NULL DEFAULT 'edit',
  payload         TEXT NOT NULL,             -- JSON ProductEdit
  note            TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'applied' | 'rejected'
  applied_version INTEGER,                   -- version produced when applied
  resolved_by     TEXT NOT NULL DEFAULT '',
  resolved_at     TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL
);
CREATE INDEX idx_contributions_status ON contributions (status, created_at);
CREATE INDEX idx_contributions_product ON contributions (product_id);
CREATE INDEX idx_contributions_account ON contributions (account_id, created_at);

-- Approvals on a contribution — one per account, never the author's own.
CREATE TABLE contribution_approvals (
  contribution_id TEXT NOT NULL REFERENCES contributions (id) ON DELETE CASCADE,
  account_id      TEXT NOT NULL REFERENCES developers (id) ON DELETE CASCADE,
  created_at      TEXT NOT NULL,
  PRIMARY KEY (contribution_id, account_id)
);
