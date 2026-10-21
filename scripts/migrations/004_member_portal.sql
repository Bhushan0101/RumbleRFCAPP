-- Additive member/event workflow; existing content and records are preserved.
CREATE TABLE portal_users (
 id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','promoter','fighter','gym','coach')),
 salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE gyms (id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL UNIQUE REFERENCES portal_users(id), name TEXT NOT NULL, city TEXT NOT NULL DEFAULT '');
CREATE TABLE coaches (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE REFERENCES portal_users(id), gym_id INTEGER REFERENCES gyms(id), name TEXT NOT NULL);
CREATE TABLE promotions (id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL UNIQUE REFERENCES portal_users(id), name TEXT NOT NULL);
CREATE TABLE fighter_profiles (
 athlete_id INTEGER PRIMARY KEY REFERENCES athletes(id), user_id INTEGER UNIQUE REFERENCES portal_users(id),
 gym_id INTEGER REFERENCES gyms(id), coach_id INTEGER REFERENCES coaches(id)
);
CREATE TABLE portal_sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES portal_users(id), expires_at INTEGER NOT NULL);
ALTER TABLE events ADD COLUMN promotion_id INTEGER REFERENCES promotions(id);
ALTER TABLE events ADD COLUMN registration_open INTEGER NOT NULL DEFAULT 0 CHECK(registration_open IN (0,1));
CREATE TABLE event_registrations (
 id INTEGER PRIMARY KEY, event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
 athlete_id INTEGER NOT NULL REFERENCES athletes(id), added_by INTEGER NOT NULL REFERENCES portal_users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(event_id,athlete_id)
);
CREATE TABLE bout_results (
 bout_id INTEGER PRIMARY KEY REFERENCES bouts(id) ON DELETE CASCADE,
 outcome TEXT NOT NULL CHECK(outcome IN ('red','blue','draw','no_contest')),
 updated_by INTEGER NOT NULL REFERENCES portal_users(id), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE result_audit (
 id INTEGER PRIMARY KEY, bout_id INTEGER NOT NULL REFERENCES bouts(id), user_id INTEGER NOT NULL REFERENCES portal_users(id),
 previous_result TEXT, new_result TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX portal_session_expiry ON portal_sessions(expires_at);
CREATE INDEX registration_athlete ON event_registrations(athlete_id);
