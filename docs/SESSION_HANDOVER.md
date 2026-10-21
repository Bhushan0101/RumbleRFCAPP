# RFC — Session Handover (pick up here next time)

## Current fighter / rankings UI update

The current interface is black and white with saffron accents. The member portal uses its own
centered stylesheet and ES modules under `public/portal/`. Fighter registration is a three-step
journey with an optional portrait; only Featherweight and Lightweight are active. The directory is
removed. Fighters see only their own gym; invitation codes connect gyms without exposing a directory.
Migration 005 adds gym invitation codes and preserves existing data. Pillow validates uploaded photos.
See [FIGHTER_JOURNEY.md](FIGHTER_JOURNEY.md) for testing and [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)
for feature boundaries. Event/promotion/gym management is retained; this iteration prioritizes the
fighter profile and portal rankings.


Render stakeholder testing is configured in `render.yaml` with `RFC_DEMO_MODE=1` and an
isolated ephemeral `RFC_DB_PATH`. Excel templates/upload preview/publication use `ranking_excel.py`;
install `requirements.txt` for Excel support. Default startup without the demo flag does not
provision dummy accounts. See [RENDER_TESTING.md](RENDER_TESTING.md) for deployment and user instructions.
Existing v4 databases are not re-seeded during initialization, preserving portal edits and ranking
omissions across process restarts on retained storage. No Render deployment was performed here.


## Member portal update — 2026-10-21

A connected first-release demo is now implemented. See [MEMBER_PORTAL.md](MEMBER_PORTAL.md) for
accounts, runtime database, registration/event/result workflows, tests and first go-live options.
Schema v4 adds accounts and affiliations, promoter ownership, registrations and result auditing.
Rankings now use stored positions; public events show registrations/cards and athlete profiles show
bouts. This update supersedes older statements below about those features being unconnected.
Dummy accounts are seeded by the explicit command or opt-in `RFC_DEMO_MODE=1` startup flag. No production deployment occurred.


Last updated: 2026-10-21. This file is the fast path back into the project. Read it, then
`CLAUDE.md` → `docs/ARCHITECTURE.md` → `docs/DATABASE.md` as needed.

## How to run

```sh
python server.py                 # http://localhost:8000  (binds 127.0.0.1 only)
python scripts/check_project.py  # full self-check — must print PASS
node --check public/app.js       # optional JS syntax check (and public/admin.js)
```

Admin panel: **http://localhost:8000/admin.html**. It is **disabled until a password is set**.
Legacy CMS is disabled unless `admin_config.json` or its environment credentials are configured.
For the connected demo use the member portal accounts in `docs/RENDER_TESTING.md`; the app admin
is a separate role-based account, not the legacy CMS password.

## Current state (what's done)

**Current schema is version 4** (the untouched shipped database may remain v3 until startup migration). Earlier baseline: version 3 (`PRAGMA user_version=3`). Migrations live in `scripts/migrations/`,
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
- **Rankings** page now reads stored division/position/movement rows. App admins can edit positions
  or preview/publish a validated Excel workbook. Fight records update independently from results.

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
  `main.py` serves `public/` static + the read-only JSON API + the **admin write API** (reuses
  server.py's shared `op_*` CRUD functions so logic is not duplicated; migrate-on-import, idempotent).
- **Live admin (option A, ephemeral)**: enabled by setting env vars `RFC_ADMIN_SALT` +
  `RFC_ADMIN_PASSWORD_HASH` in Render (see README for the one-liner to generate them). Edits reset on
  restart (ephemeral disk). Admin UI shows a "LIVE DEMO" banner on non-localhost hosts. For durable
  edits use a persistent disk / external DB, or edit locally and push.
- **Local dev is unchanged and needs zero packages**: `python server.py` (full site + admin write API,
  binds 127.0.0.1; legacy CMS credentials are optional and configured separately).
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
