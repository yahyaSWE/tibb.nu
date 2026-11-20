function emailSchema(table: string, prefix: string) {
  return `
CREATE TABLE IF NOT EXISTS ${table} (
  id TEXT PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES shop_orders(id),
  audience TEXT NOT NULL CHECK(audience IN ('customer','admin')),
  recipient TEXT NOT NULL, sender TEXT, subject TEXT NOT NULL, body TEXT NOT NULL, html TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed','skipped')),
  attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, first_attempt_at TEXT,
  next_attempt_at TEXT NOT NULL, lease_until TEXT, lease_token TEXT, sent_at TEXT, provider_id TEXT,
  UNIQUE(order_id,audience)
);
CREATE INDEX IF NOT EXISTS ${prefix}_due ON ${table}(status,next_attempt_at);
CREATE TRIGGER IF NOT EXISTS ${prefix}_reference BEFORE INSERT ON ${table}
  WHEN NOT EXISTS(SELECT 1 FROM shop_orders WHERE id=NEW.order_id)
  BEGIN SELECT RAISE(ABORT,'Order missing'); END;
`;
}

export const SHOP_EMAIL_SCHEMA = emailSchema("shop_email_outbox", "shop_email");
export const SHOP_WITHDRAWAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS shop_withdrawals (
  order_id INTEGER PRIMARY KEY REFERENCES shop_orders(id),
  customer_name TEXT NOT NULL, received_at TEXT NOT NULL, handled_at TEXT
);
CREATE INDEX IF NOT EXISTS shop_withdrawals_pending ON shop_withdrawals(handled_at,received_at);
${emailSchema("shop_withdrawal_email_outbox", "shop_withdrawal_email")}
${emailSchema("shop_agreement_email_outbox", "shop_agreement_email")}
`;
