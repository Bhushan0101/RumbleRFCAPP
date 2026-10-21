-- Existing members are preserved; new applications must pay and pass review.
ALTER TABLE fighter_profiles ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved'
 CHECK(approval_status IN ('awaiting_payment','pending_approval','approved','rejected','suspended'));
ALTER TABLE fighter_profiles ADD COLUMN legacy_member INTEGER NOT NULL DEFAULT 1 CHECK(legacy_member IN (0,1));
ALTER TABLE fighter_profiles ADD COLUMN created_by INTEGER REFERENCES portal_users(id);
ALTER TABLE fighter_profiles ADD COLUMN reviewed_by INTEGER REFERENCES portal_users(id);
ALTER TABLE fighter_profiles ADD COLUMN reviewed_at TEXT;
ALTER TABLE fighter_profiles ADD COLUMN review_note TEXT NOT NULL DEFAULT '';
CREATE TABLE application_audit (
 id INTEGER PRIMARY KEY, athlete_id INTEGER NOT NULL REFERENCES athletes(id),
 actor_id INTEGER REFERENCES portal_users(id), action TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE payments (
 id INTEGER PRIMARY KEY, athlete_id INTEGER NOT NULL REFERENCES athletes(id), payer_id INTEGER NOT NULL REFERENCES portal_users(id),
 purpose TEXT NOT NULL DEFAULT 'fighter_application' CHECK(purpose='fighter_application'),
 amount_cents INTEGER NOT NULL CHECK(amount_cents=1000), currency TEXT NOT NULL DEFAULT 'EUR' CHECK(currency='EUR'),
 provider TEXT NOT NULL CHECK(provider IN ('demo','stripe')), is_test INTEGER NOT NULL CHECK(is_test IN (0,1)),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','failed','cancelled')),
 checkout_token TEXT NOT NULL UNIQUE, provider_session TEXT UNIQUE, provider_intent TEXT,
 receipt_number TEXT UNIQUE, payer_name TEXT NOT NULL, payer_email TEXT NOT NULL,
 fighter_name TEXT NOT NULL, duplicate_application_payment INTEGER NOT NULL DEFAULT 0 CHECK(duplicate_application_payment IN (0,1)), refunded_cents INTEGER NOT NULL DEFAULT 0 CHECK(refunded_cents>=0 AND refunded_cents<=amount_cents),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, paid_at TEXT
);
CREATE INDEX completed_application_payment ON payments(athlete_id,status);
CREATE TABLE payment_audit (
 id INTEGER PRIMARY KEY, payment_id INTEGER NOT NULL REFERENCES payments(id), actor_id INTEGER REFERENCES portal_users(id),
 action TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE provider_refunds (payment_intent TEXT PRIMARY KEY, refunded_cents INTEGER NOT NULL CHECK(refunded_cents>=0), currency TEXT NOT NULL, is_test INTEGER NOT NULL CHECK(is_test IN (0,1)));
CREATE TABLE payment_webhook_events (event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
ALTER TABLE events ADD COLUMN capacity INTEGER CHECK(capacity IS NULL OR capacity>0);
ALTER TABLE events ADD COLUMN registration_closes_at TEXT;
ALTER TABLE events ADD COLUMN categories TEXT NOT NULL DEFAULT '["Featherweight","Lightweight"]';
ALTER TABLE event_registrations ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','withdrawn','cancelled'));
ALTER TABLE event_registrations ADD COLUMN registration_ref TEXT;
ALTER TABLE event_registrations ADD COLUMN updated_at TEXT;
UPDATE event_registrations SET registration_ref='WUCO-E'||event_id||'-'||id;
CREATE UNIQUE INDEX event_entry_reference ON event_registrations(registration_ref);
CREATE TABLE event_entry_audit (
 id INTEGER PRIMARY KEY, registration_id INTEGER NOT NULL REFERENCES event_registrations(id), actor_id INTEGER NOT NULL REFERENCES portal_users(id),
 action TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
UPDATE site_settings SET value='W.U.C.O' WHERE key='brand_name';
UPDATE site_settings SET value='#171717' WHERE key='primary_color';
UPDATE site_settings SET value='#ee8b26' WHERE key='accent_color';
UPDATE events SET title=replace(title,'RFC','W.U.C.O'),subtitle=replace(subtitle,'RFC','W.U.C.O'),description=replace(description,'RFC','W.U.C.O');
UPDATE stories SET title=replace(title,'RFC','W.U.C.O'),body=replace(body,'RFC','W.U.C.O');
UPDATE promotions SET name='Demo W.U.C.O Promotions' WHERE name='Demo Rumble Promotions';
UPDATE portal_users SET email=replace(email,'@demo.rfc.test','@demo.wuco.test')
 WHERE email IN ('admin@demo.rfc.test','fighter@demo.rfc.test','promoter@demo.rfc.test','gym@demo.rfc.test','coach@demo.rfc.test');
