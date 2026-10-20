# SQLite data model

One relational database contains all content domains; separate database servers would add unnecessary operational complexity at this stage.

`database/rfc.sqlite3` is already created and seeded. `schema.sql` reproduces the tables. `seed.json` preserves the original concept content. SQLite is included in Python; use an IDE SQLite extension or Python to edit it.

| Table | Purpose | Initial rows | Frontend status |
|---|---|---:|---|
| athletes | Names, nicknames, division, nationality, W/L/D, biography, portrait and cartoon | 8 | Lists/search/filters/record connected; portrait_url (front) + cartoon_url (flip-card back) rendered; bio in dialog |
| events | Titles, status, schedule, venue, tickets and poster | 3 | Title/status/subtitle lists connected; other detail fields prepared |
| stories | Typed editorial text and media metadata | 5 | Lists and article body connected; dedicated media fields prepared |
| rankings | Position and movement by athlete/division | 8 | Seeded and API-exposed; view still derives order from athletes |
| bouts | Event-to-athlete matchups and results | 0 | Schema/API ready; not rendered |
| achievements | Athlete achievements | 0 | Schema/API ready; expandable UI still placeholder |
| media_items | Images/videos belonging to stories | 0 | Schema/API ready; not rendered |
| gallery_items | Instagram reels + YouTube/Rumble videos (standalone) | 8 | Rendered on the Gallery page; Rumble videos searchable |
| sponsors | Partner identities/assets/links | 0 | Schema/API ready; not rendered |
| sessions | Admin login session tokens | 0 | Internal; not exposed by the content API |
| site_settings | Brand configuration and schema/sample metadata (incl. instagram_url, youtube_url, gallery_enabled) | 8 | API-exposed; social URLs feed the Gallery page |

Empty tables intentionally contain no invented fight results, titles or partners. All seeded identities and records are sample data.

## Relationships

athletes → achievements (one to many)
events → bouts (one to many)
athletes → bouts (red/blue sides; optional winner)
athletes → rankings (one per division)
stories → media_items (one to many)

Foreign keys and division/position uniqueness are enforced in the schema. Python connections performing writes must enable PRAGMA foreign_keys=ON. Dates should use ISO 8601 strings, event starts_at with timezone offset; keep the IANA timezone field for display. Null dates mean unannounced, not a fake countdown.

## Recreate safely

For a fresh copy only, create the database using `python scripts/init_db.py`. Do not delete an existing edited database unless the user explicitly wants to discard its content. The initializer is idempotent for existing primary keys; it can restore deleted sample rows. It is not a general migration manager.

Schema version is `PRAGMA user_version`. `schema.sql` is the **version-1 baseline** (ends `PRAGMA user_version=1`) and is reproduced, not migrated, by `init_db.py`. Later changes are **numbered migrations**: add `scripts/migrations/NNN_name.sql` using `CREATE TABLE IF NOT EXISTS` / `INSERT OR IGNORE`, and `scripts/migrate.py` applies any file whose `NNN` exceeds the live `user_version`, inside a transaction, then bumps `user_version` to `NNN`. The runner is idempotent and preserves data; it is not a down-migrator. `server.py`, `export_content.py` and `check_project.py` all run `migrate.run()` after `initialize()`. The live DB is currently at version 3 (migration `002_gallery.sql` added `gallery_items` + `sessions` + social settings; `003_athlete_cartoon.sql` added `athletes.cartoon_url` and the `news_enabled` flag). `init_db.initialize()` preserves a higher `user_version` after replaying the v1 baseline, so re-seeding never downgrades a migrated DB. Running `CREATE TABLE IF NOT EXISTS` does not migrate columns on an existing table.

## Example edit

Back up database/rfc.sqlite3 first, then in Python:

```python
import sqlite3
with sqlite3.connect('database/rfc.sqlite3') as db:
    db.execute('PRAGMA foreign_keys=ON')
    db.execute('UPDATE athletes SET biography=? WHERE id=?',
               ('Approved biography goes here.', 1))
```

The biography column is prepared but not rendered yet. Fields already connected to the site, such as name or wins, update on browser refresh. Use parameterized queries for values. Never concatenate user input into SQL. Refresh public/data/content.json using scripts/export_content.py if deploying static files.
