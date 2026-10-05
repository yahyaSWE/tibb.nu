export const SCHEMA = `    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','student')), created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), site_name TEXT NOT NULL DEFAULT 'Tibb.nu', email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT 'Besök på plats', pay_on_site INTEGER NOT NULL DEFAULT 1, stripe_enabled INTEGER NOT NULL DEFAULT 0);
    INSERT OR IGNORE INTO settings(id) VALUES(1);
    CREATE TABLE IF NOT EXISTS treatments (id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 5 AND 480), price_ore INTEGER NOT NULL CHECK(price_ore BETWEEN 0 AND 10000000), active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS practitioners (id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)));
    INSERT OR IGNORE INTO practitioners(id,name,description,active) VALUES(1,'Tibb.nu','',1);
    CREATE TABLE IF NOT EXISTS availability_schedules (id INTEGER PRIMARY KEY, treatment_id INTEGER NOT NULL REFERENCES treatments(id), practitioner_id INTEGER NOT NULL DEFAULT 1 REFERENCES practitioners(id), start_date TEXT NOT NULL, end_date TEXT NOT NULL, weekdays TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, breaks TEXT NOT NULL DEFAULT '[]', created_count INTEGER NOT NULL DEFAULT 0, skipped_count INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS availability_blocks (id INTEGER PRIMARY KEY, practitioner_id INTEGER REFERENCES practitioners(id), start TEXT NOT NULL, end TEXT NOT NULL, all_day INTEGER NOT NULL DEFAULT 0 CHECK(all_day IN (0,1)), reason TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, CHECK(end>start));
    CREATE INDEX IF NOT EXISTS availability_blocks_dates ON availability_blocks(start,end);
    CREATE TABLE IF NOT EXISTS slots (id INTEGER PRIMARY KEY, treatment_id INTEGER NOT NULL REFERENCES treatments(id), practitioner_id INTEGER NOT NULL DEFAULT 1 REFERENCES practitioners(id), start TEXT NOT NULL, end TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0, schedule_id INTEGER REFERENCES availability_schedules(id), CHECK(end>start));
    CREATE TABLE IF NOT EXISTS bookings (id INTEGER PRIMARY KEY, reference TEXT NOT NULL UNIQUE, treatment_id INTEGER NOT NULL REFERENCES treatments(id), practitioner_id INTEGER NOT NULL DEFAULT 1 REFERENCES practitioners(id), practitioner_name TEXT NOT NULL DEFAULT 'Tibb.nu', slot_id INTEGER NOT NULL REFERENCES slots(id), treatment_name TEXT NOT NULL, duration_minutes INTEGER NOT NULL, price_ore INTEGER NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', status TEXT NOT NULL CHECK(status IN ('pending','confirmed','cancelled','completed')), payment_method TEXT NOT NULL CHECK(payment_method IN ('onsite','stripe')), payment_status TEXT NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending','paid','refunded')), checkout_session_id TEXT UNIQUE, expires_at TEXT, created_at TEXT NOT NULL);
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
      WHEN EXISTS(SELECT 1 FROM slots WHERE treatment_id=OLD.id) OR EXISTS(SELECT 1 FROM bookings WHERE treatment_id=OLD.id) OR EXISTS(SELECT 1 FROM availability_schedules WHERE treatment_id=OLD.id)
      BEGIN SELECT RAISE(ABORT,'Treatment has booking history'); END;
    CREATE TRIGGER IF NOT EXISTS availability_schedules_reference_insert BEFORE INSERT ON availability_schedules
      WHEN NOT EXISTS(SELECT 1 FROM treatments WHERE id=NEW.treatment_id)
      BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
    CREATE TRIGGER IF NOT EXISTS availability_schedules_reference_update BEFORE UPDATE OF treatment_id ON availability_schedules
      WHEN NOT EXISTS(SELECT 1 FROM treatments WHERE id=NEW.treatment_id)
      BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
    CREATE TRIGGER IF NOT EXISTS treatments_preserve_schedules BEFORE DELETE ON treatments
      WHEN EXISTS(SELECT 1 FROM availability_schedules WHERE treatment_id=OLD.id)
      BEGIN SELECT RAISE(ABORT,'Treatment has schedule history'); END;
  `;

// Apply after upgrading existing slots tables, so these triggers can reference
// schedule_id without replacing or losing historical slots and bookings.
export const SLOT_SCHEDULE_SCHEMA = `
    CREATE INDEX IF NOT EXISTS slots_schedule ON slots(schedule_id,archived,start);
    CREATE TRIGGER IF NOT EXISTS slots_schedule_reference_insert BEFORE INSERT ON slots
      WHEN NEW.schedule_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM availability_schedules WHERE id=NEW.schedule_id AND treatment_id=NEW.treatment_id)
      BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
    CREATE TRIGGER IF NOT EXISTS slots_schedule_reference_update BEFORE UPDATE OF schedule_id,treatment_id ON slots
      WHEN NEW.schedule_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM availability_schedules WHERE id=NEW.schedule_id AND treatment_id=NEW.treatment_id)
      BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
    CREATE TRIGGER IF NOT EXISTS availability_schedules_preserve_slots BEFORE DELETE ON availability_schedules
      WHEN EXISTS(SELECT 1 FROM slots WHERE schedule_id=OLD.id)
      BEGIN SELECT RAISE(ABORT,'Schedule has slot history'); END;
    CREATE INDEX IF NOT EXISTS slots_practitioner_dates ON slots(practitioner_id,start,end,archived);
    CREATE INDEX IF NOT EXISTS bookings_practitioner_dates ON bookings(practitioner_id,start,end,status);
    CREATE INDEX IF NOT EXISTS availability_blocks_practitioner_dates ON availability_blocks(practitioner_id,start,end);
    CREATE TRIGGER IF NOT EXISTS slots_practitioner_reference_insert BEFORE INSERT ON slots
      WHEN NOT EXISTS(SELECT 1 FROM practitioners WHERE id=NEW.practitioner_id)
        OR (NEW.schedule_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM availability_schedules WHERE id=NEW.schedule_id AND practitioner_id=NEW.practitioner_id))
      BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
    CREATE TRIGGER IF NOT EXISTS slots_practitioner_reference_update BEFORE UPDATE OF practitioner_id,schedule_id ON slots
      WHEN NOT EXISTS(SELECT 1 FROM practitioners WHERE id=NEW.practitioner_id)
        OR (NEW.schedule_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM availability_schedules WHERE id=NEW.schedule_id AND practitioner_id=NEW.practitioner_id))
      BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
    CREATE TRIGGER IF NOT EXISTS slots_preserve_practitioner BEFORE UPDATE OF practitioner_id ON slots
      WHEN NEW.practitioner_id<>OLD.practitioner_id AND EXISTS(SELECT 1 FROM bookings WHERE slot_id=OLD.id)
      BEGIN SELECT RAISE(ABORT,'Slot has booking history'); END;
    CREATE TRIGGER IF NOT EXISTS bookings_practitioner_reference_insert BEFORE INSERT ON bookings
      WHEN NOT EXISTS(SELECT 1 FROM slots WHERE id=NEW.slot_id AND practitioner_id=NEW.practitioner_id)
        OR NOT EXISTS(SELECT 1 FROM practitioners WHERE id=NEW.practitioner_id)
      BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
    CREATE TRIGGER IF NOT EXISTS bookings_practitioner_reference_update BEFORE UPDATE OF practitioner_id,slot_id ON bookings
      WHEN NOT EXISTS(SELECT 1 FROM slots WHERE id=NEW.slot_id AND practitioner_id=NEW.practitioner_id)
        OR NOT EXISTS(SELECT 1 FROM practitioners WHERE id=NEW.practitioner_id)
      BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
    CREATE TRIGGER IF NOT EXISTS availability_schedules_practitioner_reference_insert BEFORE INSERT ON availability_schedules
      WHEN NOT EXISTS(SELECT 1 FROM practitioners WHERE id=NEW.practitioner_id)
      BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
    CREATE TRIGGER IF NOT EXISTS availability_schedules_practitioner_reference_update BEFORE UPDATE OF practitioner_id ON availability_schedules
      WHEN NOT EXISTS(SELECT 1 FROM practitioners WHERE id=NEW.practitioner_id)
      BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
    CREATE TRIGGER IF NOT EXISTS availability_schedules_preserve_practitioner BEFORE UPDATE OF practitioner_id ON availability_schedules
      WHEN NEW.practitioner_id<>OLD.practitioner_id AND EXISTS(SELECT 1 FROM slots WHERE schedule_id=OLD.id)
      BEGIN SELECT RAISE(ABORT,'Schedule has slot history'); END;
    CREATE TRIGGER IF NOT EXISTS availability_blocks_practitioner_reference_insert BEFORE INSERT ON availability_blocks
      WHEN NEW.practitioner_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM practitioners WHERE id=NEW.practitioner_id)
      BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
    CREATE TRIGGER IF NOT EXISTS availability_blocks_practitioner_reference_update BEFORE UPDATE OF practitioner_id ON availability_blocks
      WHEN NEW.practitioner_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM practitioners WHERE id=NEW.practitioner_id)
      BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
    CREATE TRIGGER IF NOT EXISTS practitioners_preserve_history BEFORE DELETE ON practitioners
      WHEN EXISTS(SELECT 1 FROM slots WHERE practitioner_id=OLD.id)
        OR EXISTS(SELECT 1 FROM bookings WHERE practitioner_id=OLD.id)
        OR EXISTS(SELECT 1 FROM availability_schedules WHERE practitioner_id=OLD.id)
        OR EXISTS(SELECT 1 FROM availability_blocks WHERE practitioner_id=OLD.id)
      BEGIN SELECT RAISE(ABORT,'Practitioner has booking history'); END;
`;
