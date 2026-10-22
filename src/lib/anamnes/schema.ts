export const ANAMNES_SCHEMA = `
  CREATE TABLE IF NOT EXISTS anamnes_formulas (
    id TEXT PRIMARY KEY, data_json TEXT NOT NULL, updated_at TEXT NOT NULL,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS anamnes_cases (
    id TEXT PRIMARY KEY, encrypted_payload TEXT NOT NULL,
    created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0)
  );
  CREATE INDEX IF NOT EXISTS anamnes_cases_expiry ON anamnes_cases(expires_at);
  CREATE TABLE IF NOT EXISTS self_test_cases (
    id TEXT PRIMARY KEY, encrypted_payload TEXT NOT NULL,
    created_at TEXT NOT NULL, expires_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS self_test_cases_expiry ON self_test_cases(expires_at);
  CREATE TABLE IF NOT EXISTS anamnes_case_reviews (
    case_id TEXT NOT NULL REFERENCES anamnes_cases(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL CHECK(revision>=1), encrypted_payload TEXT NOT NULL,
    reviewed_at TEXT NOT NULL, author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY(case_id,revision)
  );
  CREATE TRIGGER IF NOT EXISTS anamnes_cases_cleanup BEFORE DELETE ON anamnes_cases BEGIN
    DELETE FROM anamnes_case_reviews WHERE case_id=OLD.id;
  END;
  CREATE TRIGGER IF NOT EXISTS anamnes_reviews_reference BEFORE INSERT ON anamnes_case_reviews
    WHEN NOT EXISTS(SELECT 1 FROM anamnes_cases WHERE id=NEW.case_id)
    BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
  CREATE TRIGGER IF NOT EXISTS users_anamnes_cleanup BEFORE DELETE ON users BEGIN
    UPDATE anamnes_formulas SET updated_by=NULL WHERE updated_by=OLD.id;
    UPDATE anamnes_case_reviews SET author_id=NULL WHERE author_id=OLD.id;
  END;
`;
