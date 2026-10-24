-- 010_gym_onboarding.sql — Gym enquiries, onboarding tokens, outbound mail log.
--
-- Public gym enquiry flow:
--   1. Prospective gym submits a short enquiry at /gyms/join.html → gym_enquiries row.
--   2. WUCO admin reviews from the admin portal, clicks "Send onboarding form"
--      → creates a one-time signed URL in gym_onboarding_tokens.
--   3. Gym opens the URL, fills in the onboarding form → creates a gym record
--      with status='pending_review', uploads timetable image, classes, prices.
--   4. WUCO admin approves → coach account is created, gym goes 'active'.

CREATE TABLE outbound_mail (
  id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL,
  read_at TEXT
);
CREATE INDEX outbound_mail_recent ON outbound_mail(created_at DESC);
CREATE INDEX outbound_mail_unread ON outbound_mail(read_at) WHERE read_at IS NULL;

CREATE TABLE gym_enquiries (
  id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  gym_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new'
    CHECK(status IN ('new','invited','onboarding','submitted','approved','rejected')),
  invited_by INTEGER REFERENCES portal_users(id),
  invited_at TEXT,
  reviewed_by INTEGER REFERENCES portal_users(id),
  reviewed_at TEXT,
  review_note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX gym_enquiries_recent ON gym_enquiries(created_at DESC);

CREATE TABLE gym_onboarding_tokens (
  token TEXT PRIMARY KEY,
  enquiry_id INTEGER NOT NULL REFERENCES gym_enquiries(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

-- Rich gym attributes: logo, hero, about, Revolut handle, timetable image, status.
ALTER TABLE gyms ADD COLUMN logo_url TEXT;
ALTER TABLE gyms ADD COLUMN hero_url TEXT;
ALTER TABLE gyms ADD COLUMN about TEXT NOT NULL DEFAULT '';
ALTER TABLE gyms ADD COLUMN revolut_handle TEXT NOT NULL DEFAULT '';
ALTER TABLE gyms ADD COLUMN timetable_image_url TEXT;
ALTER TABLE gyms ADD COLUMN slug TEXT;
ALTER TABLE gyms ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
  CHECK(status IN ('pending_review','active','suspended'));
ALTER TABLE gyms ADD COLUMN contact_email TEXT NOT NULL DEFAULT '';

-- Rebuild gyms so owner_id can be NULL (gym exists before its coach account does, during
-- onboarding review). SQLite can't ALTER COLUMN, so we rebuild the table.
PRAGMA foreign_keys=OFF;
CREATE TABLE gyms_new (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER UNIQUE REFERENCES portal_users(id),
  name TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  join_code TEXT,
  logo_url TEXT,
  hero_url TEXT,
  about TEXT NOT NULL DEFAULT '',
  revolut_handle TEXT NOT NULL DEFAULT '',
  timetable_image_url TEXT,
  slug TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK(status IN ('pending_review','active','suspended')),
  contact_email TEXT NOT NULL DEFAULT ''
);
INSERT INTO gyms_new SELECT id,owner_id,name,city,join_code,logo_url,hero_url,about,
  revolut_handle,timetable_image_url,slug,status,contact_email FROM gyms;
DROP TABLE gyms;
ALTER TABLE gyms_new RENAME TO gyms;
CREATE UNIQUE INDEX gym_join_code ON gyms(join_code);
CREATE UNIQUE INDEX gym_slug ON gyms(slug) WHERE slug IS NOT NULL;
PRAGMA foreign_keys=ON;

-- Pricing products: single day pass, weekly, monthly, per-class.
CREATE TABLE gym_products (
  id INTEGER PRIMARY KEY,
  gym_id INTEGER NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('day_pass','weekly_pass','monthly_pass','per_class')),
  title TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK(price_cents>=0 AND price_cents<=1000000),
  currency TEXT NOT NULL DEFAULT 'EUR',
  revolut_url TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);

-- Scheduled classes (structured timetable rows alongside the uploaded image).
CREATE TABLE gym_classes (
  id INTEGER PRIMARY KEY,
  gym_id INTEGER NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  discipline TEXT NOT NULL DEFAULT '',
  day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 10 AND 300),
  capacity INTEGER NOT NULL DEFAULT 20 CHECK(capacity BETWEEN 1 AND 500),
  per_class_price_cents INTEGER CHECK(per_class_price_cents IS NULL OR per_class_price_cents>=0),
  revolut_url TEXT NOT NULL DEFAULT '',
  colour TEXT NOT NULL DEFAULT ''
);

-- A fighter booking against a gym_class (per-class drop-in). Pass products do not
-- consume a class slot here; they're a free-text purchase handled off-site via Revolut.
CREATE TABLE class_bookings (
  id INTEGER PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES gym_classes(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES portal_users(id),
  guest_name TEXT NOT NULL DEFAULT '',
  guest_email TEXT NOT NULL DEFAULT '',
  booked_for_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK(status IN ('pending_payment','paid','cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  marked_paid_at TEXT
);
CREATE INDEX class_bookings_by_class ON class_bookings(class_id, booked_for_date);

-- Fighter → gym join requests (gym admin approves).
CREATE TABLE gym_join_requests (
  id INTEGER PRIMARY KEY,
  gym_id INTEGER NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES portal_users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','approved','rejected')),
  reviewed_at TEXT,
  review_note TEXT NOT NULL DEFAULT '',
  UNIQUE(gym_id, user_id)
);
