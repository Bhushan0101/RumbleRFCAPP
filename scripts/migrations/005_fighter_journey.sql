-- Share a gym invitation without exposing the gym directory to fighters.
ALTER TABLE gyms ADD COLUMN join_code TEXT;
UPDATE gyms SET join_code=upper(hex(randomblob(4))) WHERE join_code IS NULL;
CREATE UNIQUE INDEX gym_join_code ON gyms(join_code);
