export const SCHEMA = `    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','student')), created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), site_name TEXT NOT NULL DEFAULT 'Tibb.nu', email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT 'Besök på plats', pay_on_site INTEGER NOT NULL DEFAULT 1, stripe_enabled INTEGER NOT NULL DEFAULT 0);
    INSERT OR IGNORE INTO settings(id) VALUES(1);
    CREATE TABLE IF NOT EXISTS treatments (id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 5 AND 480), price_ore INTEGER NOT NULL CHECK(price_ore BETWEEN 0 AND 10000000), active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS slots (id INTEGER PRIMARY KEY, treatment_id INTEGER NOT NULL REFERENCES treatments(id), start TEXT NOT NULL, end TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0, CHECK(end>start));
    CREATE TABLE IF NOT EXISTS bookings (id INTEGER PRIMARY KEY, reference TEXT NOT NULL UNIQUE, treatment_id INTEGER NOT NULL REFERENCES treatments(id), slot_id INTEGER NOT NULL REFERENCES slots(id), treatment_name TEXT NOT NULL, duration_minutes INTEGER NOT NULL, price_ore INTEGER NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', status TEXT NOT NULL CHECK(status IN ('pending','confirmed','cancelled','completed')), payment_method TEXT NOT NULL CHECK(payment_method IN ('onsite','stripe')), payment_status TEXT NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending','paid','refunded')), checkout_session_id TEXT UNIQUE, expires_at TEXT, created_at TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS bookings_active_slot ON bookings(slot_id) WHERE status IN ('pending','confirmed','completed');
    CREATE INDEX IF NOT EXISTS bookings_dates ON bookings(start,end,status);
    CREATE TABLE IF NOT EXISTS articles (id INTEGER PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, excerpt TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', published INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS courses (id INTEGER PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '', price_ore INTEGER NOT NULL DEFAULT 0 CHECK(price_ore BETWEEN 0 AND 10000000), published INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS lessons (id INTEGER PRIMARY KEY, course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', video_url TEXT NOT NULL DEFAULT '', material_url TEXT NOT NULL DEFAULT '', position INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS enrollments (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE, created_at TEXT NOT NULL, UNIQUE(user_id,course_id));
    CREATE TABLE IF NOT EXISTS progress (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE, completed_at TEXT NOT NULL, PRIMARY KEY(user_id,lesson_id));
    CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    -- Keep relationships correct on HTTP connections whose foreign-key pragma
    -- is scoped to a stream. These also work alongside local FK enforcement.
    CREATE TRIGGER IF NOT EXISTS courses_cleanup BEFORE DELETE ON courses BEGIN
      DELETE FROM progress WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id=OLD.id);
      DELETE FROM lessons WHERE course_id=OLD.id;
      DELETE FROM enrollments WHERE course_id=OLD.id;
    END;
    CREATE TRIGGER IF NOT EXISTS lessons_cleanup BEFORE DELETE ON lessons BEGIN
      DELETE FROM progress WHERE lesson_id=OLD.id;
    END;
    CREATE TRIGGER IF NOT EXISTS users_cleanup BEFORE DELETE ON users BEGIN
      DELETE FROM sessions WHERE user_id=OLD.id;
      DELETE FROM enrollments WHERE user_id=OLD.id;
      DELETE FROM progress WHERE user_id=OLD.id;
    END;
    CREATE TRIGGER IF NOT EXISTS sessions_reference_insert BEFORE INSERT ON sessions
      WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id)
      BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
    CREATE TRIGGER IF NOT EXISTS sessions_reference_update BEFORE UPDATE OF user_id ON sessions
      WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id)
      BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
    CREATE TRIGGER IF NOT EXISTS lessons_reference_insert BEFORE INSERT ON lessons
      WHEN NOT EXISTS(SELECT 1 FROM courses WHERE id=NEW.course_id)
      BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
    CREATE TRIGGER IF NOT EXISTS lessons_reference_update BEFORE UPDATE OF course_id ON lessons
      WHEN NOT EXISTS(SELECT 1 FROM courses WHERE id=NEW.course_id)
      BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
    CREATE TRIGGER IF NOT EXISTS enrollments_reference_insert BEFORE INSERT ON enrollments
      WHEN NOT EXISTS(SELECT 1 FROM courses WHERE id=NEW.course_id) OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id)
      BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
    CREATE TRIGGER IF NOT EXISTS enrollments_reference_update BEFORE UPDATE OF course_id,user_id ON enrollments
      WHEN NOT EXISTS(SELECT 1 FROM courses WHERE id=NEW.course_id) OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id)
      BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
    CREATE TRIGGER IF NOT EXISTS progress_reference_insert BEFORE INSERT ON progress
      WHEN NOT EXISTS(SELECT 1 FROM lessons WHERE id=NEW.lesson_id) OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id)
      BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
    CREATE TRIGGER IF NOT EXISTS progress_reference_update BEFORE UPDATE OF lesson_id,user_id ON progress
      WHEN NOT EXISTS(SELECT 1 FROM lessons WHERE id=NEW.lesson_id) OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id)
      BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
    CREATE TRIGGER IF NOT EXISTS slots_reference_insert BEFORE INSERT ON slots
      WHEN NOT EXISTS(SELECT 1 FROM treatments WHERE id=NEW.treatment_id)
      BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
    CREATE TRIGGER IF NOT EXISTS slots_reference_update BEFORE UPDATE OF treatment_id ON slots
      WHEN NOT EXISTS(SELECT 1 FROM treatments WHERE id=NEW.treatment_id)
      BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
    CREATE TRIGGER IF NOT EXISTS bookings_reference_insert BEFORE INSERT ON bookings
      WHEN NOT EXISTS(SELECT 1 FROM slots WHERE id=NEW.slot_id AND treatment_id=NEW.treatment_id)
      BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
    CREATE TRIGGER IF NOT EXISTS bookings_reference_update BEFORE UPDATE OF slot_id,treatment_id ON bookings
      WHEN NOT EXISTS(SELECT 1 FROM slots WHERE id=NEW.slot_id AND treatment_id=NEW.treatment_id)
      BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
    CREATE TRIGGER IF NOT EXISTS slots_preserve_bookings BEFORE DELETE ON slots
      WHEN EXISTS(SELECT 1 FROM bookings WHERE slot_id=OLD.id)
      BEGIN SELECT RAISE(ABORT,'Slot has booking history'); END;
    CREATE TRIGGER IF NOT EXISTS treatments_preserve_history BEFORE DELETE ON treatments
      WHEN EXISTS(SELECT 1 FROM slots WHERE treatment_id=OLD.id) OR EXISTS(SELECT 1 FROM bookings WHERE treatment_id=OLD.id)
      BEGIN SELECT RAISE(ABORT,'Treatment has booking history'); END;
  `;
