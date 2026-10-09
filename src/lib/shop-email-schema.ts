export const SHOP_EMAIL_SCHEMA = `
CREATE TABLE IF NOT EXISTS shop_email_outbox (
  id TEXT PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES shop_orders(id),
  audience TEXT NOT NULL CHECK(audience IN ('customer','admin')),
  recipient TEXT NOT NULL, sender TEXT, subject TEXT NOT NULL, body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed','skipped')),
  attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, first_attempt_at TEXT,
  next_attempt_at TEXT NOT NULL, lease_until TEXT, lease_token TEXT, sent_at TEXT, provider_id TEXT,
  UNIQUE(order_id,audience)
);
CREATE INDEX IF NOT EXISTS shop_email_due ON shop_email_outbox(status,next_attempt_at);
CREATE TRIGGER IF NOT EXISTS shop_email_reference BEFORE INSERT ON shop_email_outbox
  WHEN NOT EXISTS(SELECT 1 FROM shop_orders WHERE id=NEW.order_id)
  BEGIN SELECT RAISE(ABORT,'Order missing'); END;
`;
