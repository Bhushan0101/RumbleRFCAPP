-- Migration 003: athlete flip-card cartoon image + public feature flags.
-- Idempotent. The runner (scripts/migrate.py) sets PRAGMA user_version.

ALTER TABLE athletes ADD COLUMN cartoon_url TEXT;

INSERT OR IGNORE INTO site_settings(key,value) VALUES
 ('news_enabled','1');

UPDATE site_settings SET value='3' WHERE key='schema_version';
