-- 009_fighter_passport.sql — Digital Fighter Passport.
--
-- Each approved fighter gets a stable, public-facing fighter number of the form
-- `IRL-000NNN`. The number is assigned automatically on admin approval (not at
-- registration) so declined applications never consume a slot.
--
-- `fighter_passports` sits alongside `fighter_profiles` so a passport outlives
-- the account row that created it (e.g. a fighter whose email changes keeps
-- the same IRL number). It also makes the public lookup a single-table query.

CREATE TABLE fighter_passports (
  athlete_id INTEGER PRIMARY KEY REFERENCES athletes(id),
  fighter_no TEXT NOT NULL UNIQUE,
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX fighter_passports_fighter_no ON fighter_passports(fighter_no);
