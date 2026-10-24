-- 008_fighter_class.sql — Fighter experience class + martial art.
--
-- Class is an experience tier stored alongside weight division:
--   J  — J-Class (Under 18)
--   N  — N-Class (up to 5 recorded fights)
--   L  — L-Class (Learning class)
--   C  — C-Class (No shin pads)
--   B  — B-Class (Debut pro)
--   A  — A-Class (Seasoned pro)
--
-- Martial art is free text (e.g. "K-1", "Kickboxing", "MMA", "Muay Thai", "Brazilian Jiu Jitsu").

ALTER TABLE athletes ADD COLUMN class_code TEXT
  CHECK(class_code IS NULL OR class_code IN ('J','N','L','C','B','A'));

ALTER TABLE athletes ADD COLUMN martial_art TEXT NOT NULL DEFAULT '';

-- No backfill: existing sample athletes keep class_code=NULL and martial_art=''. Admin can
-- assign a class per fighter once real data is supplied.
