# RFC — Rumble Fighting Championship

## Current fighter / rankings UI update

The current interface is black and white with saffron accents. The member portal uses its own
centered stylesheet and ES modules under `public/portal/`. Fighter registration is a three-step
journey with an optional portrait; only Featherweight and Lightweight are active. The directory is
removed. Fighters see only their own gym; invitation codes connect gyms without exposing a directory.
Migration 005 adds gym invitation codes and preserves existing data. Pillow validates uploaded photos.
See [FIGHTER_JOURNEY.md](docs/FIGHTER_JOURNEY.md) for testing and [PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)
for feature boundaries. Event/promotion/gym management is retained; this iteration prioritizes the
fighter profile and portal rankings.


## New: connected member portal demo

Use **Member portal** in the site navigation for fighter/gym/coach registration, independent
promotions, event entry/counts, published fight cards and promoter result updates. App admins manage
ranking positions. See [the demo walkthrough and go-live options](docs/MEMBER_PORTAL.md) for the
five dummy accounts, isolated runtime database, seeding commands, limitations and validation.
Dummy users require explicit local seeding or `RFC_DEMO_MODE=1` (configured in the stakeholder-test Render blueprint).
The portal requires the Python server (including the existing WSGI entry point), not static hosting.


A responsive combat-sports website inspired by the supplied UFC reference screenshots, branded with the user's RFC logo: deep green, championship gold, white editorial layouts and dark arena sections.

## Render stakeholder testing and Excel rankings

[Render deployment and testing guide](docs/RENDER_TESTING.md) covers the demo-enabled blueprint,
five test logins and the admin Excel template → preview → publish workflow. Free-tier demo changes
can reset on restart/redeploy. No deployment was performed here.
[Sample Excel template](docs/templates/RFC-rankings-template.xlsx).

## Run in your IDE

Requires **Python 3.10+**. The public site and basic member portal need no pip packages, Node, API keys or paid services. For fighter photo uploads, Excel ranking uploads and Render hosting, first run `python -m pip install -r requirements.txt`.

```sh
python server.py
```

On Windows, use `py server.py` if `python` is unavailable. On macOS/Linux, use `python3 server.py` if needed. Open **http://localhost:8000**. Do not open index.html directly; the frontend loads JSON over HTTP.

Optional port:

```sh
python server.py --port 8080
```

The server binds to this computer only (127.0.0.1). It is a local development server, not a production hosting service.

## What's included

- `public/`: complete HTML, CSS, JavaScript and image assets.
- `database/rfc.sqlite3`: ready-to-use, seeded SQLite database.
- `database/schema.sql`: schema, relationships and constraints.
- `database/seed.json`: initial demonstration content.
- `server.py`: static file server and read-only JSON API.
- `scripts/init_db.py`: creates missing tables and sample rows; preserves existing rows.
- `scripts/export_content.py`: exports database content for standalone static hosting.
- `CLAUDE.md`: the first file Claude should read.
- `docs/`: project intent, architecture, database notes, acceptance criteria and original visual references.

## Pages and working behaviour

Home, Events, Rankings, Athletes and About use hash routes (`/#athletes`, etc.). Includes mobile navigation, athlete search, division and country filters, event tabs, site search, detail dialogs, expandable athlete information, and athlete flip-cards (portrait → cartoon). The Gallery and News pages are built but switched off by default (feature flags).

The core athlete, event, story and gallery lists load from SQLite via `/api/content`. Some detail copy and ranking presentation still use concept placeholders. Additional relational tables are prepared for future integration; see `docs/DATABASE.md`.

## Local admin (optional)

An optional, local-only content-management panel lives at **http://localhost:8000/admin.html**. It is
**disabled by default**. To enable it, set a local password once:

```sh
python scripts/set_admin_password.py
```

This writes `admin_config.json` (gitignored, stores only a PBKDF2 hash — never a plaintext password,
never under `public/`). Then reload `/admin.html`, sign in, and manage athletes, events, bouts,
rankings, achievements and sponsors. Organisers can **upload athlete images** (PNG/JPG/WEBP, saved to
`public/assets/athletes/` and linked to the fighter) and **bulk-add athletes from a CSV** — download
the template in the Athletes tab, fill it in Excel/Numbers/Sheets, and import. The public content API
stays read-only; writes go through the authenticated `/api/admin/*` API with field, URL and image
validation. This is a local development tool — keep the server bound to 127.0.0.1 and do not expose it.

**Gallery and News are currently switched off** (feature flags in the admin **Settings & flags** tab).
Instagram support is parked — see `docs/INSTAGRAM.md`. Athlete cards flip to show a stylised cartoon
on the back when a `cartoon_url` image is supplied.

## Editing data

Open `database/rfc.sqlite3` in an SQLite editor in your IDE, or use Python's built-in sqlite3. Back it up first. After changing content, refresh the browser. The database server does not cache reads.

The initializer uses stable IDs and INSERT OR IGNORE: it does not overwrite edits, but rerunning it restores deleted sample rows. When moving to real data, replace the seed workflow deliberately before removing samples.

Schema changes use numbered migrations in `scripts/migrations/`, applied by `scripts/migrate.py` (run automatically on server start, export and checks). Back up `database/rfc.sqlite3` before applying a new migration. The database is currently at schema version 2 (added the gallery and sessions tables).

For static hosting without the Python server, first run:

```sh
python scripts/export_content.py
```

Then deploy the contents of `public/`. It falls back to `public/data/content.json` when `/api/content` is unavailable. Static hosting cannot read a live SQLite database; re-export after edits.

## Deploy to Render

A `render.yaml` and `Procfile` are included, and `main.py` exposes a WSGI `app`, so Render's default
Python settings work with no dashboard changes:

- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn main:app`  (Render's default — serves `public/` + the read-only JSON API)

`requirements.txt` includes Gunicorn for hosting and openpyxl/defusedxml for Excel ranking uploads, and Pillow for fighter photos. **The public site and basic local portal still need zero packages** — run `python server.py` for the full site including the admin write API. The deployed WSGI app (`main.py`) serves the public content API, the authenticated member portal,
and the optional legacy admin API. Public content reads remain read-only; authenticated routes handle writes.

Render's filesystem is **ephemeral**, so admin writes and uploaded images do **not** persist across
deploys/restarts — the deployed site serves the committed seeded demo (athletes, rankings, generated
fighter images). For a fully static deploy instead, publish the `public/` folder to any static host
(it uses the `content.json` fallback).

### Enabling the live admin (optional, demo-only)

The deployed WSGI app (`main.py`) includes the authenticated admin write API, but it stays **disabled
until you set a password via environment variables** in the Render dashboard:

1. Generate a hash + salt locally:
   `python -c "import hashlib,secrets; s=secrets.token_bytes(16); print('SALT',s.hex()); print('HASH',hashlib.pbkdf2_hmac('sha256',b'YOUR_PASSWORD',s,200000).hex())"`
2. In Render → your service → **Environment**, add `RFC_ADMIN_SALT` and `RFC_ADMIN_PASSWORD_HASH`
   from the output above (the plaintext password never leaves your machine).
3. Redeploy, then open `/admin.html` on the live URL and sign in.

Admin edits on the live site are **ephemeral** (they reset on the next restart/deploy). The panel shows
a "LIVE DEMO ADMIN — changes reset" banner on hosted instances. For durable edits, use a persistent
disk / external database, or just edit locally (`python server.py`) and push. This stdlib/WSGI server
has no rate limiting; only enable the live admin for a trusted demo.

## Important content status

All athlete identities, records, rankings, events and stories are samples. The arena image was generated for this concept. It is not evidence of a real RFC event and does not depict the named sample athletes. The logo artwork was supplied by the user. Tickets, venue details, official contacts, policies and videos have not been supplied. Member registration and event entry are implemented as a sample-data demo. No payments, email delivery, eligibility verification or real ticket purchasing are implemented.

The original hosted concept remains at https://rfc-rumble-fighting.tunedchair7.chatgpt.site and was not changed by this export. This package adds the local database and server. It contains no hosting credentials or original Git repository metadata.

## Checks

```sh
python scripts/check_project.py
```

This checks schema integrity, seed counts, idempotent initialization and the content contract. If Node is available, `node --check public/app.js` checks frontend syntax. Browser/device visual QA is still required.

Google Fonts supplies Barlow / Barlow Condensed when online; local system fonts are fallbacks. All imagery is bundled locally.
