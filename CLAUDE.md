# Instructions for Claude / IDE coding assistants

## Current fighter / rankings UI update

The current interface is black and white with saffron accents. The member portal uses its own
centered stylesheet and ES modules under `public/portal/`. Fighter registration is a three-step
journey with an optional portrait; only Featherweight and Lightweight are active. The directory is
removed. Fighters see only their own gym; invitation codes connect gyms without exposing a directory.
Migration 005 adds gym invitation codes and preserves existing data. Pillow validates uploaded photos.
See [FIGHTER_JOURNEY.md](docs/FIGHTER_JOURNEY.md) for testing and [PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)
for feature boundaries. Event/promotion/gym management is retained; this iteration prioritizes the
fighter profile and portal rankings.


Render stakeholder testing is configured in `render.yaml` with `RFC_DEMO_MODE=1` and an
isolated ephemeral `RFC_DB_PATH`. Excel templates/upload preview/publication use `ranking_excel.py`;
install `requirements.txt` for Excel support. Default startup without the demo flag does not
provision dummy accounts. See [docs/RENDER_TESTING.md](docs/RENDER_TESTING.md) for deployment and user instructions.
Existing v4 databases are not re-seeded during initialization, preserving portal edits and ranking
omissions across process restarts on retained storage. No Render deployment was performed here.


## Current update (2026-10-21)

Read `docs/MEMBER_PORTAL.md` for the connected registration/event/results demo and go-live scope.
`portal.py` and `public/portal.*` add role-based accounts; migration 004 adds schema v4.
Use `RFC_DB_PATH` for an isolated development database and seed dummy accounts only with explicit
`scripts/seed_portal_demo.py --local-demo`. Existing tracked database/assets were not replaced.
Stored ranking positions, event cards and athlete fight history are now connected. Result
corrections must use the portal's atomic accounting/audit path, not generic CMS record edits.
Run `python -m unittest discover -s tests -v` as well as the existing project checker.
Keep this guide and project docs current when implementing further changes.


Read this file first, followed by `docs/PROJECT_INTENT.md`, `docs/ARCHITECTURE.md` and `docs/DATABASE.md`.

## Goal

Continue developing **RFC — Rumble Fighting Championship**, a responsive website inspired by the user's supplied UFC screenshots, using the supplied RFC identity and the current black/white/saffron direction. This is a working concept and portable local development handover, not an established live ticketing business platform.

## Preserve

- The user's RFC identity, black/white/saffron palette and overall editorial structure.
- Centred logo, white floating-style navigation, condensed uppercase headings, dark event blocks, athlete grids and feature-story layouts.
- Responsive behaviour and accessible native dialogs, labelled controls, keyboard focus and reduced-motion support.
- Clear sample-content labelling until real information is verified.
- Existing working navigation, search, filters and detail dialogs.

## Stack and commands

Vanilla HTML/CSS/JavaScript in `public/`. Standard-library Python server and SQLite. No npm build step. Core site/member workflows use stdlib; install requirements.txt for photo uploads, Excel rankings and Gunicorn hosting.

- Run: `python server.py` → http://localhost:8000
- Checks: `python scripts/check_project.py`
- Optional JS syntax check: `node --check public/app.js`
- Refresh static export: `python scripts/export_content.py`

## Data rules

The working database is `database/rfc.sqlite3`. Back it up before migrations. `database/schema.sql` is version 1, not a migration runner. Do not delete/recreate the database to change schema. Preserve user edits. The supplied initializer restores missing sample IDs; revise seeding before switching to real content.

Athletes/events/stories/gallery items load from the API. Rankings now read stored positions/movement. Event cards and athlete fight history use bouts/results. Achievements, media_items and sponsors remain prepared/API-exposed but are not integrated into their public displays. Do not claim those remaining features are complete.

An optional, authentication-gated admin write API exists under `/api/admin/*` (see `docs/ARCHITECTURE.md`). It is **disabled by default** and stays off until a local password is set with `python scripts/set_admin_password.py` (writes `admin_config.json`, which is gitignored and must never live under `public/`). Organisers can CRUD athletes/events/bouts/rankings/achievements/sponsors, **upload athlete images** (admin-only, saved to `public/assets/athletes/`), and **bulk-import athletes from a CSV template**. The public content API remains read-only. All DB-derived text is escaped at render (`esc`) and URLs validated (`safeUrl` client-side, `v_url` server-side) — keep it that way for any new rendered field.

**Gallery and News are feature-flagged OFF** (`site_settings.gallery_enabled`/`news_enabled` = `'0'`); the code and admin endpoints remain but their nav/routes and admin editing are hidden. Instagram is parked — see `docs/INSTAGRAM.md`. Re-enable by setting the flags to `'1'` and re-adding the `stories`/`gallery_items` entries to `SPECS` in `public/admin.js`. Athlete cards flip (front `portrait_url` = cut-out PNG, back `cartoon_url` = stylised cartoon); both images are supplied by the organiser, not generated in-code.

Do not invent real RFC people, fights, results, partners, dates, records, contacts or legal text. Replace samples only with user-approved content. The same generated arena image is reused deliberately as illustrative imagery; athlete cards need actual approved portraits.

## Useful next work

1. Connect rank positions, bouts, athlete biographies, achievements, media galleries and sponsors to their existing tables.
2. Use verified per-athlete portraits and per-event posters instead of reused concept imagery.
3. Add real event dates, countdowns and official ticket links only after those are supplied.
4. Replace placeholder contact and policy dialogs with approved content.
5. Content management: an authenticated local admin write API now exists (`/api/admin/*`, optional, disabled until a password is set). Extend it carefully — keep validation/escaping, auth and the 127.0.0.1 bind.
6. Add meaningful integration tests as behaviour expands, then desktop/mobile browser QA.

## Technical boundaries

The Python server is local development only. Do not expose it publicly as a production server. No credentials ship with the project; the admin password, if set, lives only in the gitignored `admin_config.json` (or env vars) — never add secrets to frontend code or commit them. Content rendering uses template strings/innerHTML: DB-derived text is now escaped at render and URLs are validated on both client and server. Maintain that escaping/validation for any new rendered field or write path.

Do not introduce a framework, remote database, payment provider or cloud dependency without a concrete need from the user. Keep existing features working while improving the implementation. See `docs/NEXT_STEPS.md` for the completion checklist.
