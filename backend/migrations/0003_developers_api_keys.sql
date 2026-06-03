-- Developer accounts + API keys + per-key rate-limit buckets.
-- Reads now require an API key; developers self-register and manage their own keys.

CREATE TABLE developers (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,                 -- pbkdf2$<iter>$<saltHex>$<hashHex>
  name          TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_developers_email ON developers (lower(email));

CREATE TABLE api_keys (
  id            TEXT PRIMARY KEY,
  developer_id  TEXT NOT NULL REFERENCES developers (id) ON DELETE CASCADE,
  prefix        TEXT NOT NULL,                 -- public identifier, indexed
  key_hash      TEXT NOT NULL,                 -- SHA-256 of the secret (hex)
  name          TEXT NOT NULL DEFAULT '',
  revoked       INTEGER NOT NULL DEFAULT 0,
  request_count INTEGER NOT NULL DEFAULT 0,
  last_used_at  TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_api_keys_prefix ON api_keys (prefix);
CREATE INDEX idx_api_keys_developer ON api_keys (developer_id);

-- Fixed-window rate-limit counters (one row per key/ip per window).
CREATE TABLE rate_buckets (
  bucket     TEXT PRIMARY KEY,                 -- "<keyId|ip>:<windowStart>"
  count      INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL                  -- epoch ms (for housekeeping)
);
