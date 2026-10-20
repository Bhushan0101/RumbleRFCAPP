# RFC — Rumble Fighting Championship

A responsive combat-sports website inspired by the supplied UFC reference screenshots, branded with the user's RFC logo: deep green, championship gold, white editorial layouts and dark arena sections.

## Run in your IDE

Requires **Python 3.10+**. No pip packages, Node installation, API keys, accounts or paid services are required to run the site.

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

A `render.yaml` and `Procfile` are included. On Render, create a **Web Service** from this repo:

- Build command: `python scripts/export_content.py`
- Start command: `python server.py --host 0.0.0.0`  (Render provides `$PORT`; the server reads it)

The server binds `0.0.0.0` only when you pass `--host`/set `HOST`; locally it stays on `127.0.0.1`.
Render's filesystem is **ephemeral**, so admin writes and uploaded images do **not** persist across
deploys/restarts — the deployed site serves the committed seeded demo (athletes, rankings, generated
fighter images). For a fully static deploy instead, publish the `public/` folder to any static host
(it uses the `content.json` fallback). Set an admin password via env vars
(`RFC_ADMIN_PASSWORD_HASH` / `RFC_ADMIN_SALT`) only if you intend to use the admin panel in a trusted
setting — this stdlib server has no rate limiting and is not hardened for untrusted production traffic.

## Important content status

All athlete identities, records, rankings, events and stories are samples. The arena image was generated for this concept. It is not evidence of a real RFC event and does not depict the named sample athletes. The logo artwork was supplied by the user. Tickets, venue details, official contacts, policies and videos have not been supplied. No payments, email delivery, registration or real ticket purchasing are implemented.

The original hosted concept remains at https://rfc-rumble-fighting.tunedchair7.chatgpt.site and was not changed by this export. This package adds the local database and server. It contains no hosting credentials or original Git repository metadata.

## Checks

```sh
python scripts/check_project.py
```

This checks schema integrity, seed counts, idempotent initialization and the content contract. If Node is available, `node --check public/app.js` checks frontend syntax. Browser/device visual QA is still required.

Google Fonts supplies Barlow / Barlow Condensed when online; local system fonts are fallbacks. All imagery is bundled locally.
