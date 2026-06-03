-- Seeds a fixed developer + API key for LOCAL DEV / E2E only (never run in prod).
-- Key: omrp_live_devkeyprefix.dev0000000000000000000000000000000000000000000000
INSERT OR IGNORE INTO developers (id, email, password_hash, name, created_at)
VALUES ('dev-fixed', 'fixed@local', 'x', 'Local Dev', '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO api_keys (id, developer_id, prefix, key_hash, name, created_at)
VALUES (
  'key-fixed', 'dev-fixed', 'devkeyprefix',
  '75f788d955e4a866b5955a07ce6f4238f822c89c63ed4516401598f890290942',
  'local', '2026-01-01T00:00:00.000Z'
);
