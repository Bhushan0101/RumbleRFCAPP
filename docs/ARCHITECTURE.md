# Architecture

## Current W.U.C.O application and event workflow

New fighters submit a private application; an administrator reviews and approves (or rejects) it before
public listing, ranking publication or event entry. **There is no application fee** — the previous
€10 payment flow has been removed (migration 007). Event entry supports category, capacity and deadline
checks, confirmation references and safe withdrawal. Schema version is 7. See
[FUTURE_PLANS.md](FUTURE_PLANS.md) for provider payments and Apple Wallet, both intentionally parked.


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


## Runtime flow

Browser → Python server → static assets in public/.
Browser → GET /api/content → SQLite queries → JSON → frontend views.
If the API is unavailable, the frontend fetches data/content.json for static-only use.

`public/app.js` initializes after loading content. It keeps athletes/events/stories in memory for the session. All routing is hash-based, so direct page links do not require server rewrite rules. Refresh the page after database changes.

## Files

- index.html: shared header, footer, modal and main region.
- style.css: complete visual system and breakpoints at 1500/1050/760px.
- app.js: view renderers, filters, local search, dialogs and content loading.
- server.py: Python ThreadingHTTPServer, static handler, SQLite read endpoints, and the optional auth-gated admin write API.
- scripts/init_db.py: schema and demo seeding (v1 baseline).
- scripts/migrate.py + scripts/migrations/NNN_*.sql: numbered, idempotent migration runner (advances a live DB past v1).
- scripts/set_admin_password.py: one-time local admin password setup (writes gitignored admin_config.json).
- scripts/export_content.py: database-to-static JSON export.
- public/admin.html + public/admin.js: local admin content-management UI (separate from the public SPA).

## API

Public content endpoints are GET-only JSON, use no authentication and are intended for localhost.

| Route | Response |
|---|---|
| /api/health | Service and database status (live schema version) |
| /api/content | All content collections and settings |
| /api/athletes | Athlete rows, with nick/record compatibility fields |
| /api/events | Event rows, with sub compatibility field |
| /api/stories | Editorial content |
| /api/gallery_items | Instagram reels + YouTube/Rumble videos |
| /api/rankings | Prepared ranking rows |
| /api/bouts | Prepared event matchups |
| /api/achievements | Prepared athlete achievements |
| /api/media_items | Prepared gallery/video assets |
| /api/sponsors | Prepared partners |
| /api/settings | Brand settings map (incl. instagram_url, youtube_url, gallery_enabled) |

GET responses are generated from fresh read-only SQLite connections. The server only serves public/ as static files; the SQLite database and documents are outside that directory.

## Admin write API (optional, local, auth-gated)

Under `/api/admin/*`, **disabled by default**. It stays off (writes return 503) until a local admin
password is configured via `python scripts/set_admin_password.py` (PBKDF2-HMAC-SHA256 hash stored in
the gitignored `admin_config.json` at the repo root — never under `public/`; env vars
`RFC_ADMIN_PASSWORD_HASH`/`RFC_ADMIN_SALT` also work).

- `POST /api/admin/login` / `logout`, `GET /api/admin/session` — session lifecycle. Login issues an
  opaque token stored in the `sessions` table and a `HttpOnly; SameSite=Strict` cookie (8h expiry).
- `GET|POST /api/admin/<collection>`, `PUT|DELETE /api/admin/<collection>/<id>` — CRUD over an
  allowlisted set of tables (athletes, events, gallery_items, bouts, rankings, achievements,
  sponsors). `PUT /api/admin/settings/<key>` upserts an allowlisted setting (incl. the
  `gallery_enabled`/`news_enabled` feature flags).
- `POST /api/admin/upload` — admin-only athlete image upload (multipart, hand-parsed; PNG/JPG/WEBP
  validated by magic bytes; 6 MB cap; server-generated filename written to `public/assets/athletes/`).
- `POST /api/admin/import/athletes` + `GET /api/admin/template/athletes.csv` — CSV bulk import with a
  downloadable template; each row validated with the athlete validators, bad rows skipped and reported.
- Every write runs on a read-write connection (`PRAGMA foreign_keys=ON`), after auth, with
  per-field validation and http/https URL validation. CSRF defenses: 127.0.0.1 bind, SameSite=Strict
  cookie, a required `X-Requested-With: fetch` header, and same-origin Origin/Referer checks.
- Rendering is XSS-safe: `public/app.js` and `public/admin.js` escape all DB-derived text (`esc`) and
  route src/href through `safeUrl` so admin-entered content cannot script the site.
- Feature flags: Gallery and News are off by default (`gallery_enabled`/`news_enabled`); their routes,
  nav links and admin editing are hidden while off. Instagram is parked — see `docs/INSTAGRAM.md`.

## Known limitations

Cards use one generated arena image repeatedly unless a per-row image URL is supplied via admin. Athlete and event dialogs include concept copy (biography/venue show real values when entered). Rankings derive from athlete order rather than reading rankings rows. Expanded tables (bouts/achievements/media_items/sponsors) are not yet rendered. The Gallery page renders gallery_items (Instagram reels + YouTube/Rumble videos) as link-out tiles with a client-side search over Rumble videos; URLs are sample placeholders until real accounts are connected in admin. Privacy/terms/contact are placeholders. Google Fonts needs internet access. Browser/device QA was unavailable in the build environment.

## Production path

Retain static public/ hosting for an editorial-only site, exporting JSON after updates. For live content editing, choose an authenticated backend/CMS and migrate the read API deliberately. Add input validation, text escaping, URL validation, authentication, authorization and backups before untrusted writes. Do not use the included Python development HTTP server as public production hosting.
