-- Migration 002: Gallery (Instagram reels + YouTube/Rumble videos) and admin sessions.
-- Idempotent: safe to run repeatedly. The runner (scripts/migrate.py) sets PRAGMA user_version.
-- schema.sql remains the v1 baseline; this file layers v2 on top of a live database.

CREATE TABLE IF NOT EXISTS gallery_items (
  id INTEGER PRIMARY KEY,
  platform TEXT NOT NULL CHECK(platform IN('instagram','youtube','rumble')),
  kind TEXT NOT NULL CHECK(kind IN('reel','video')),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  description TEXT NOT NULL DEFAULT '',
  is_sample INTEGER NOT NULL DEFAULT 1 CHECK(is_sample IN(0,1)),
  display_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_gallery_platform ON gallery_items(platform,display_order);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- Sample gallery entries. Clearly-labelled placeholders; swap URLs for real RFC content
-- via the admin panel. Stable ids keep INSERT OR IGNORE idempotent.
INSERT OR IGNORE INTO gallery_items(id,platform,kind,title,url,thumbnail_url,description,is_sample,display_order) VALUES
 (1,'instagram','reel','Sample reel · Fight week energy','https://www.instagram.com/','assets/arena.webp','Illustrative reel placeholder. Connect the RFC Instagram account in the admin panel.',1,0),
 (2,'instagram','reel','Sample reel · Inside the cage','https://www.instagram.com/','assets/arena.webp','Illustrative reel placeholder. Connect the RFC Instagram account in the admin panel.',1,1),
 (3,'instagram','reel','Sample reel · Walkout moment','https://www.instagram.com/','assets/arena.webp','Illustrative reel placeholder. Connect the RFC Instagram account in the admin panel.',1,2),
 (4,'youtube','video','Sample video · RFC channel trailer','https://www.youtube.com/','assets/arena.webp','Illustrative video placeholder. Connect the RFC YouTube channel in the admin panel.',1,3),
 (5,'rumble','video','Rumble Night 01 · Highlights (sample)','https://www.youtube.com/','assets/arena.webp','Illustrative Rumble video placeholder. Searchable from the gallery.',1,4),
 (6,'rumble','video','Rumble Night 02 · Highlights (sample)','https://www.youtube.com/','assets/arena.webp','Illustrative Rumble video placeholder. Searchable from the gallery.',1,5),
 (7,'rumble','video','Rumble Night 03 · Full event recap (sample)','https://www.youtube.com/','assets/arena.webp','Illustrative Rumble video placeholder. Searchable from the gallery.',1,6),
 (8,'rumble','video','Rumble Rewind · Best knockouts (sample)','https://www.youtube.com/','assets/arena.webp','Illustrative Rumble video placeholder. Searchable from the gallery.',1,7);

-- New brand settings. Placeholder social URLs; edit in the admin panel.
INSERT OR IGNORE INTO site_settings(key,value) VALUES
 ('instagram_url','https://www.instagram.com/'),
 ('youtube_url','https://www.youtube.com/'),
 ('gallery_enabled','1');

UPDATE site_settings SET value='2' WHERE key='schema_version';
