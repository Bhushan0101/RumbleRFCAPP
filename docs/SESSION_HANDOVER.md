# RFC — Session Handover (pick up here next time)

Last updated: 2026-10-20. This file is the fast path back into the project. Read it, then
`CLAUDE.md` → `docs/ARCHITECTURE.md` → `docs/DATABASE.md` as needed.

## How to run

```sh
python server.py                 # http://localhost:8000  (binds 127.0.0.1 only)
python scripts/check_project.py  # full self-check — must print PASS
node --check public/app.js       # optional JS syntax check (and public/admin.js)
```

Admin panel: **http://localhost:8000/admin.html**. It is **disabled until a password is set**.
Current local dev password is **`test123`** (stored only as a PBKDF2 hash in the gitignored
`admin_config.json`; the real setup command is `python scripts/set_admin_password.py`, which
enforces an 8-char minimum). `admin_config.json` is NOT committed — a fresh clone has admin off.

## Current state (what's done)

**Schema is at version 3** (`PRAGMA user_version=3`). Migrations live in `scripts/migrations/`,
applied by `scripts/migrate.py` (idempotent, version-gated). `database/schema.sql` stays the v1
baseline; `init_db.initialize()` preserves a higher version so re-seeding never downgrades.
Backup before migrating: `database/rfc.sqlite3.backup` exists.

- **Admin write API** (`/api/admin/*`, auth-gated, optional): login/logout/session, CRUD over
  athletes/events/bouts/rankings/achievements/sponsors, `PUT /settings/<key>`, athlete image
  **upload** (`POST /api/admin/upload`), and **CSV bulk import** of athletes
  (`POST /api/admin/import/athletes` + `GET /api/admin/template/athletes.csv`).
- **Security**: all DB text escaped at render via `esc()`; URLs via `safeUrl()` (client) and
  `v_url()` (server). Uploads validated by magic bytes (PNG/JPG/WEBP), 6 MB cap, server-generated
  filenames into `public/assets/athletes/`. CSRF: 127.0.0.1 bind + SameSite=Strict cookie +
  required `X-Requested-With: fetch` header + same-origin Origin/Referer check.
- **Athlete flip-cards**: front = `portrait_url`, back = `cartoon_url`; flips on click/Enter,
  reduced-motion safe. Fallback: if `portrait_url` is null → arena image; if `cartoon_url` is null
  → card gets `no-flip` (no blank back). `safeUrl()` returns `''` (falsy) for missing/invalid so
  `safeUrl(x) || fallback` works — do not make it return `'#'` again (that caused blank images).
- **Demo data**: `scripts/seed_demo_fighters.py` (stdlib only, idempotent) seeds **16 demo fighters
  across all three divisions** (Lightweight, Featherweight, Welterweight) and **generates a unique
  portrait + cartoon SVG for every athlete** (24 total — demo + original 8). Portraits use a dark
  fight-card headshot style (matching the UFC-card reference). The **#1 ranked fighter in each
  division is the champion and is drawn wearing an RFC belt** on both the portrait (front) and the
  cartoon (back), plus a "CHAMPION" tag on the portrait. It also rebuilds `rankings` per division by
  record (wins desc). Re-run any time: `python scripts/seed_demo_fighters.py` (regenerates all images;
  champion = rankings position 1). Tune the roster/records by editing the `FIGHTERS` list at the top.
- **Rankings** page reads athletes by division ordered by `display_order,id`; the `rankings` table is
  seeded and ordered by record for the two focus divisions.

## Feature flags — intentionally OFF (can re-enable)

In `site_settings`: `gallery_enabled='0'`, `news_enabled='0'`.
- Public frontend hides the Gallery and News nav links + routes (requests fall back to Home) and the
  News-dependent home sections.
- Admin UI does not list Gallery or Stories collections (see `SPECS` in `public/admin.js`).
- Server endpoints for them still exist.

**To turn back on**: set the flag(s) to `'1'` in admin → *Settings & flags* (or update
`site_settings`), re-add the `stories`/`gallery_items` entries to `SPECS` in `public/admin.js`
(field lists are in `docs/INSTAGRAM.md`), then `python scripts/export_content.py`.

## Instagram — parked

Built (link-out reels/videos Gallery page + IG/YouTube URLs in settings) but switched off. No live
Meta embed (would need a cloud dependency + account/token). Full detail + re-enable steps in
`docs/INSTAGRAM.md`.

## Deploy / Render (render-ready)

- Deployed via **`main.py`** (a WSGI `app`) so Render's default `gunicorn main:app` works with no
  dashboard changes. `requirements.txt` = just `gunicorn`; `render.yaml` + `Procfile` included.
  `main.py` serves `public/` static + the **read-only** JSON API only (migrate-on-import, idempotent).
- **Local dev is unchanged and needs zero packages**: `python server.py` (full site + admin write API,
  binds 127.0.0.1; `--host 0.0.0.0` + `$PORT`/`HOST` for any raw-server hosting).
- The `end_headers` override sends `Cache-Control: no-store` on static files so stale JS/CSS never
  causes a blank page (that was the earlier all-white bug — old cached `app.js`).
- Render filesystem is ephemeral → admin writes/uploads don't persist; deployed site serves the
  committed seeded demo. Generated fighter images under `public/assets/athletes/` are **committed**.
- Git: pushed to https://github.com/Bhushan0101/RumbleRFCAPP (branch `main`).
  `admin_config.json`, `*.backup`, `.claude/`, `public/assets/uploads/`, `__pycache__` are gitignored.

## Key files

| File | Role |
|---|---|
| `server.py` | static server + read API + admin write API (auth, validation, upload, CSV import) |
| `public/app.js` | public SPA; `esc`/`safeUrl`, flip-card, feature-flag gating, routes |
| `public/admin.html` / `admin.js` | local admin UI (CRUD, upload, CSV import, settings/flags) |
| `scripts/migrate.py` + `scripts/migrations/*.sql` | numbered migration runner (v1→v3) |
| `scripts/seed_demo_fighters.py` | demo fighters + per-athlete portrait/cartoon SVG generator + rankings |
| `scripts/set_admin_password.py` | one-time admin password setup (PBKDF2 → `admin_config.json`) |
| `scripts/check_project.py` | full self-check (schema, FKs, contracts, validators) |
| `docs/INSTAGRAM.md` | Gallery/News/Instagram parked state + re-enable steps |

## Open ideas / next work

- Images are **procedurally-generated SVG placeholders** (unique per fighter, dark card-style, belts
  for champions, offline, no deps), not real photos. Swap in real portraits/cartoons via admin upload
  when available. The `safeUrl(x) || arenaImage` fallback still covers any athlete with no portrait.
- Not yet rendered on the public site: `bouts`, `achievements`, `media_items`, `sponsors` (tables +
  API ready). Could add demo events/bouts next to match the fighters.
- `gitignore` excludes `admin_config.json`, `public/assets/athletes/`, `public/assets/uploads/`,
  `*.backup` — generated demo images are therefore not committed; re-run the seeder to regenerate.
- If real `.xlsx` import is ever needed it requires `openpyxl` (breaks the no-deps rule) — current
  import is CSV-only by design.
