-- 007_remove_fee.sql — Remove the €10 fighter application fee entirely.
--
-- 1. Promote any lingering 'awaiting_payment' profiles to 'pending_approval'.
-- 2. Drop payment infrastructure tables.
-- 3. Rebuild fighter_profiles with a tightened CHECK on approval_status
--    (SQLite can't ALTER an existing CHECK constraint, so the table is rebuilt).

PRAGMA foreign_keys=OFF;

UPDATE fighter_profiles SET approval_status='pending_approval' WHERE approval_status='awaiting_payment';

DROP INDEX IF EXISTS completed_application_payment;
DROP TABLE IF EXISTS payment_webhook_events;
DROP TABLE IF EXISTS provider_refunds;
DROP TABLE IF EXISTS payment_audit;
DROP TABLE IF EXISTS payments;

-- Rebuild fighter_profiles without 'awaiting_payment' in the CHECK.
CREATE TABLE fighter_profiles_new (
  athlete_id INTEGER PRIMARY KEY REFERENCES athletes(id),
  user_id INTEGER UNIQUE REFERENCES portal_users(id),
  gym_id INTEGER REFERENCES gyms(id),
  coach_id INTEGER REFERENCES coaches(id),
  approval_status TEXT NOT NULL DEFAULT 'pending_approval'
    CHECK(approval_status IN ('pending_approval','approved','rejected','suspended')),
  legacy_member INTEGER NOT NULL DEFAULT 1 CHECK(legacy_member IN (0,1)),
  created_by INTEGER REFERENCES portal_users(id),
  reviewed_by INTEGER REFERENCES portal_users(id),
  reviewed_at TEXT,
  review_note TEXT NOT NULL DEFAULT ''
);

INSERT INTO fighter_profiles_new
  (athlete_id,user_id,gym_id,coach_id,approval_status,legacy_member,created_by,reviewed_by,reviewed_at,review_note)
SELECT
  athlete_id,user_id,gym_id,coach_id,approval_status,legacy_member,created_by,reviewed_by,reviewed_at,review_note
FROM fighter_profiles;

DROP TABLE fighter_profiles;
ALTER TABLE fighter_profiles_new RENAME TO fighter_profiles;

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
