export const SERVICE_PAYMENT_SCHEMA = `
CREATE TABLE IF NOT EXISTS kustom_service_payments (
  reference TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('booking','course')),
  environment TEXT NOT NULL CHECK(environment IN ('production','playground')),
  callback_hash TEXT NOT NULL,
  capture_key TEXT NOT NULL,
  order_id TEXT UNIQUE,
  candidate_id TEXT,
  session_id TEXT,
  redirect_url TEXT,
  line_json TEXT NOT NULL,
  deadline TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','paid','cancelled','refunded')),
  needs_reconcile INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS kustom_service_payment_queue ON kustom_service_payments(state, needs_reconcile, checked_at);
DROP TRIGGER IF EXISTS course_purchase_grant_reference;
CREATE TRIGGER course_purchase_grant_reference BEFORE INSERT ON course_purchases
WHEN NOT EXISTS (
  SELECT 1 FROM course_purchase_attempts a
  WHERE a.id=NEW.attempt_id AND a.status='paid' AND a.user_id=NEW.user_id AND a.course_id=NEW.course_id
    AND a.group_id IS NEW.group_id AND a.session_id=NEW.session_id
    AND a.price_ore=NEW.price_ore AND a.vat_percent=NEW.vat_percent
    AND ((a.group_access_days IS NULL AND NEW.group_expires_at IS NULL)
      OR (a.group_access_days IS NOT NULL AND abs(julianday(NEW.group_expires_at)-julianday(NEW.paid_at)-a.group_access_days)<0.000011574))
    AND (
      (a.session_id NOT LIKE 'kustom_%' AND EXISTS (
        SELECT 1 FROM course_purchase_customers c WHERE c.user_id=a.user_id AND c.stripe_id=a.customer_id
      )) OR (a.session_id='kustom_' || a.id AND EXISTS (
        SELECT 1 FROM kustom_service_payments k WHERE k.reference=a.id AND k.kind='course' AND k.state='paid'
          AND 'kustom:' || k.order_id=NEW.payment_intent_id AND NEW.payment_intent_id=NEW.charge_id
      ))
    )
)
BEGIN SELECT RAISE(ABORT,'Course purchase grant constraint failed'); END;
`;
