PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS athletes (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, nickname TEXT NOT NULL DEFAULT '', division TEXT NOT NULL,
 country TEXT NOT NULL, wins INTEGER NOT NULL CHECK(wins>=0), losses INTEGER NOT NULL CHECK(losses>=0), draws INTEGER NOT NULL CHECK(draws>=0),
 biography TEXT, portrait_url TEXT, is_sample INTEGER NOT NULL DEFAULT 1 CHECK(is_sample IN(0,1)), display_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS events (
 id INTEGER PRIMARY KEY, title TEXT NOT NULL, subtitle TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN('Upcoming','Past')),
 starts_at TEXT, timezone TEXT NOT NULL DEFAULT 'Europe/Dublin', venue TEXT, city TEXT, ticket_url TEXT, poster_url TEXT,
 description TEXT, is_sample INTEGER NOT NULL DEFAULT 1 CHECK(is_sample IN(0,1)), display_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS stories (
 id INTEGER PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN('News','Interviews','Videos','Galleries')),
 body TEXT NOT NULL, image_url TEXT, video_url TEXT, published_at TEXT, is_sample INTEGER NOT NULL DEFAULT 1 CHECK(is_sample IN(0,1)), display_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS bouts (
 id INTEGER PRIMARY KEY, event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
 red_athlete_id INTEGER NOT NULL REFERENCES athletes(id), blue_athlete_id INTEGER NOT NULL REFERENCES athletes(id),
 division TEXT NOT NULL, card_section TEXT NOT NULL DEFAULT 'Main card' CHECK(card_section IN('Main card','Preliminary card')),
 bout_order INTEGER NOT NULL DEFAULT 0, winner_id INTEGER REFERENCES athletes(id), result_method TEXT, result_round INTEGER,
 result_time TEXT, CHECK(red_athlete_id<>blue_athlete_id), CHECK(winner_id IS NULL OR winner_id=red_athlete_id OR winner_id=blue_athlete_id)
);
CREATE TABLE IF NOT EXISTS rankings (
 id INTEGER PRIMARY KEY, division TEXT NOT NULL, athlete_id INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
 position INTEGER NOT NULL CHECK(position>=0), movement INTEGER NOT NULL DEFAULT 0, updated_at TEXT,
 is_sample INTEGER NOT NULL DEFAULT 1 CHECK(is_sample IN(0,1)), UNIQUE(division,position), UNIQUE(division,athlete_id)
);
CREATE TABLE IF NOT EXISTS achievements (
 id INTEGER PRIMARY KEY, athlete_id INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
 title TEXT NOT NULL, description TEXT, achieved_on TEXT, display_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS media_items (
 id INTEGER PRIMARY KEY, story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
 asset_url TEXT NOT NULL, alt_text TEXT NOT NULL DEFAULT '', media_type TEXT NOT NULL CHECK(media_type IN('image','video')),
 display_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sponsors (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, logo_url TEXT, website_url TEXT, display_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_athlete_division ON athletes(division);
CREATE INDEX IF NOT EXISTS idx_event_bouts ON bouts(event_id,bout_order);
CREATE INDEX IF NOT EXISTS idx_story_type ON stories(type);
PRAGMA user_version = 1;
