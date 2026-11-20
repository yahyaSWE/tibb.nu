export const WELLNESS_SCHEMA = `
CREATE TRIGGER IF NOT EXISTS wellness_product_insert BEFORE INSERT ON shop_products
WHEN NEW.wellness_eligible=1 AND (NEW.is_service!=1 OR NEW.kind!='product' OR NEW.price_ore>100000)
BEGIN SELECT RAISE(ABORT,'Invalid wellness service'); END;
CREATE TRIGGER IF NOT EXISTS wellness_product_update BEFORE UPDATE ON shop_products
WHEN NEW.wellness_eligible=1 AND (NEW.is_service!=1 OR NEW.kind!='product' OR NEW.price_ore>100000)
BEGIN SELECT RAISE(ABORT,'Invalid wellness service'); END;
CREATE TABLE IF NOT EXISTS wellness_order_snapshots (
  order_reference TEXT PRIMARY KEY REFERENCES shop_orders(reference), seller_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shop_checkout_requests (
  attempt_id TEXT PRIMARY KEY, request_hash TEXT NOT NULL,
  order_reference TEXT NOT NULL UNIQUE REFERENCES shop_orders(reference)
);
CREATE TABLE IF NOT EXISTS kustom_checkouts (
  order_reference TEXT PRIMARY KEY REFERENCES shop_orders(reference),
  provider_id TEXT UNIQUE, candidate_id TEXT, needs_reconcile INTEGER NOT NULL DEFAULT 0,
  environment TEXT NOT NULL CHECK(environment IN ('playground','production')),
  callback_hash TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('creating','ready','uncertain')),
  redirect_url TEXT, lease_until TEXT NOT NULL, capture_key TEXT NOT NULL,
  authorized INTEGER NOT NULL DEFAULT 0, captured INTEGER NOT NULL DEFAULT 0,
  customer_paid INTEGER NOT NULL DEFAULT 0, method TEXT NOT NULL DEFAULT '',
  refunded_ore INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS wellness_payment_evidence (
  order_reference TEXT PRIMARY KEY REFERENCES shop_orders(reference),
  source TEXT NOT NULL, reference TEXT NOT NULL UNIQUE, paid_at TEXT NOT NULL,
  amount_ore INTEGER NOT NULL CHECK(amount_ore>0), method TEXT NOT NULL,
  actor_id INTEGER REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS wellness_provider_events (event_key TEXT PRIMARY KEY, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS wellness_manual_operations (operation_id TEXT PRIMARY KEY, order_reference TEXT NOT NULL UNIQUE, request_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS wellness_passes (
  id TEXT PRIMARY KEY, order_reference TEXT NOT NULL REFERENCES shop_orders(reference),
  product_id INTEGER NOT NULL, service_name TEXT NOT NULL,
  original_quantity INTEGER NOT NULL CHECK(original_quantity BETWEEN 1 AND 99),
  remaining INTEGER NOT NULL CHECK(remaining>=0 AND remaining<=original_quantity),
  refunded_quantity INTEGER NOT NULL DEFAULT 0 CHECK(refunded_quantity>=0 AND refunded_quantity<=original_quantity),
  valid_until TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','blocked','refunded')),
  created_at TEXT NOT NULL, UNIQUE(order_reference,product_id)
);
CREATE INDEX IF NOT EXISTS wellness_pass_order ON wellness_passes(order_reference,status);
CREATE TABLE IF NOT EXISTS wellness_redemptions (
  id TEXT PRIMARY KEY, pass_id TEXT NOT NULL REFERENCES wellness_passes(id),
  operation_id TEXT NOT NULL UNIQUE, change INTEGER NOT NULL CHECK(change IN (-1,1)),
  reverses_id TEXT UNIQUE REFERENCES wellness_redemptions(id),
  reason TEXT NOT NULL, actor_id INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS wellness_receipt_sequences (year INTEGER PRIMARY KEY, last_number INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS wellness_receipts (
  id TEXT PRIMARY KEY, number TEXT NOT NULL UNIQUE, order_reference TEXT NOT NULL REFERENCES shop_orders(reference),
  event_key TEXT NOT NULL UNIQUE, kind TEXT NOT NULL CHECK(kind IN ('purchase','correction')),
  snapshot_json TEXT NOT NULL, amount_ore INTEGER NOT NULL, pdf BLOB, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS wellness_receipt_order ON wellness_receipts(order_reference,created_at);
CREATE TABLE IF NOT EXISTS wellness_order_voids (
  order_reference TEXT PRIMARY KEY REFERENCES shop_orders(reference),
  retained_reference TEXT NOT NULL REFERENCES shop_orders(reference),
  correction_id TEXT NOT NULL UNIQUE REFERENCES wellness_receipts(id),
  actor_id INTEGER NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL, created_at TEXT NOT NULL,
  CHECK(order_reference<>retained_reference)
);
CREATE INDEX IF NOT EXISTS wellness_order_void_retained ON wellness_order_voids(retained_reference);
CREATE TABLE IF NOT EXISTS wellness_downloads (
  token_hash TEXT PRIMARY KEY, receipt_id TEXT NOT NULL REFERENCES wellness_receipts(id), expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS wellness_email_outbox (
  id TEXT PRIMARY KEY, receipt_id TEXT NOT NULL REFERENCES wellness_receipts(id),
  event_key TEXT NOT NULL UNIQUE, recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed','skipped')),
  attempts INTEGER NOT NULL DEFAULT 0, lease_token TEXT, lease_until TEXT, next_attempt_at TEXT NOT NULL,
  first_attempt_at TEXT, sent_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS wellness_refunds (
  id TEXT PRIMARY KEY, order_reference TEXT NOT NULL REFERENCES shop_orders(reference),
  operation_id TEXT NOT NULL UNIQUE, actor_id INTEGER NOT NULL REFERENCES users(id),
  lines_json TEXT NOT NULL, amount_ore INTEGER NOT NULL CHECK(amount_ore>0),
  provider_id TEXT UNIQUE, status TEXT NOT NULL CHECK(status IN ('pending','confirmed')),
  proof_reference TEXT UNIQUE, reason TEXT NOT NULL, created_at TEXT NOT NULL
);
`;
