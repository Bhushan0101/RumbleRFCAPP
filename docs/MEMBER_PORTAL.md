# First release demo: members, events and fight-day records

## Current fighter / rankings UI update

The current interface is black and white with saffron accents. The member portal uses its own
centered stylesheet and ES modules under `public/portal/`. Fighter registration is a three-step
journey with an optional portrait; only Featherweight and Lightweight are active. The directory is
removed. Fighters see only their own gym; invitation codes connect gyms without exposing a directory.
Migration 005 adds gym invitation codes and preserves existing data. Pillow validates uploaded photos.
See [FIGHTER_JOURNEY.md](FIGHTER_JOURNEY.md) for testing and [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)
for feature boundaries. Event/promotion/gym management is retained; this iteration prioritizes the
fighter profile and portal rankings.


Implemented 2026-10-21. This is a connected development demo, not a published production launch.
The existing green/gold public site, news/gallery flags, assets and content remain in place.
The new **Member portal** navigation opens `public/portal.html`. Rankings now use stored ranking
positions rather than roster order. Public event dialogs show participant counts and fight cards;
athlete dialogs show their published bouts and results.

## Explore the prepared cloud instance

The server is running with `RFC_DB_PATH=/workspace/.rfc-runtime/rfc.sqlite3`, a separate development
copy. The tracked seeded SQLite database is unchanged. Open the site's **Member portal**, choose
**Sign in / Register**, expand **Local dummy accounts**, and choose a role.

| Role | Email | Connected data and capabilities |
| --- | --- | --- |
| App admin | `admin@demo.rfc.test` | Member list, manage all events, publish division ranking positions |
| Promoter | `promoter@demo.rfc.test` | Demo Rumble Promotions → RFC Demo · First Bell; manages only its own events |
| Fighter | `fighter@demo.rfc.test` | Demo Alex Fighter → Demo Emerald Gym → Demo Casey Coach |
| Gym | `gym@demo.rfc.test` | Demo Emerald Gym; can register affiliated fighters |
| Coach | `coach@demo.rfc.test` | Demo Casey Coach → Demo Emerald Gym; can register affiliated fighters |

All five dummy accounts use the public local-demo password **`RfcDemo2026!`**. They are created by the explicit seed command or by enabling `RFC_DEMO_MODE=1`.
The stakeholder-test Render blueprint enables that flag; default startup without it creates no
dummy accounts. Use only sample data with these public test accounts. The portal app admin is separate from the legacy `/admin.html` CMS
password; that old CMS remains disabled unless independently configured.

The sample event has two registered fighters and a published Lightweight bout: Demo Alex Fighter
versus Demo Jordan Guest. Jordan has an athlete profile but no login, demonstrating a promoter-added
outside competitor. Browser validation recorded a win then corrected it to no contest; both records
returned to 0–0–0 and the audit history was retained in the runtime copy.

## Reproduce locally

Python 3.10+ and SQLite from the Python standard library are enough for basic workflows.
Install `requirements.txt` for Excel ranking uploads and Gunicorn hosting. Use an existing checkout;
cloud tasks are already isolated and do not require another Git worktree.

To preserve the shipped database, first copy it to a **new** development path outside the checkout
(e.g. using SQLite's backup API; do not overwrite an existing edited copy). Set `RFC_DB_PATH` to
that absolute path for **every** command below. Without this variable the original documented
workflow still uses `database/rfc.sqlite3`; back it up before migrating.

```sh
export RFC_DB_PATH=/absolute/path/to/development.sqlite3
python scripts/seed_portal_demo.py --local-demo
python server.py --host 127.0.0.1 --port 8000
```

The seed command applies pending migrations first. It requires an existing database and preserves
existing dummy accounts, affiliations, registrations, bout results and passwords when rerun.
Startup migrates the selected database. Dummy accounts are seeded only with `RFC_DEMO_MODE=1`
or the explicit seed command. Existing v4 databases are not re-seeded during initialization.
`gunicorn main:app` exposes the same portal routes through the existing WSGI entry point.

## Working flow

1. Register a gym, coach, fighter or promoter account. Gym/coach links are optional. A coach may
   link to a gym; a fighter may link to either, both, or neither. A promotion is independent of them.
   **Edit my profile connections** can add/remove optional links later. A fighter cannot claim an
   existing athlete by supplying its ID; registration creates a new zero-record profile.
2. A promoter creates an event under its own promotion, supplies date/time, IANA timezone, venue,
   city and description, and opens registration. Only that promoter or app admin can edit it.
3. Fighters register themselves; gyms/coaches register their affiliated fighters. Promoters can
   add existing athletes or create a guest competitor without creating a login. Registration counts
   are calculated from stored unique event/athlete entries. Closed/past events reject new entries.
4. The promoter selects two registered entrants and publishes a main/preliminary-card bout. A fighter
   cannot be paired with themself or appear twice in the same event. Published cards are public.
5. On fight day, the promoter enters winner/draw/no contest, method, round and time. Both records,
   the bout result and its audit entry commit in one SQLite transaction. Repeated saves do not
   double-count. A correction reverses the previous contribution then applies the replacement.
   No contest contributes no W/L/D. Result entry is not date-gated, allowing rehearsal and delayed entry.
6. App admin publishes ranking positions. Moving an athlete shifts other positions in its division
   and stores movement/update time. Results update records but do not automatically change rankings;
   ranking policy remains a separate editorial choice.

The legacy CMS cannot edit/delete a portal-recorded bout or overwrite its fighters' W/L/D through
its generic record editor. Corrections belong in the portal so the accounting remains consistent.
Events with recorded results cannot be deleted. Unrelated old CMS functionality remains available.

## Data and API

Migration `004_member_portal.sql` advances schema to v4, adding `portal_users`, `portal_sessions`,
`gyms`, `coaches`, `promotions`, `fighter_profiles`, `event_registrations`, `bout_results`, `result_audit`,
and event promotion/registration fields. Existing athlete records and content are preserved.
`RFC_DB_PATH` is shared by initialization, migrations, servers, checks, seeding and export commands.

`ranking_excel.py` adds admin-only XLSX template/preview/publication; see [the Excel guide](RENDER_TESTING.md#excel-template-and-upload).

`portal.py` is the shared API implementation for both HTTP adapters. Routes live under `/api/portal/`:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `state` | Public directories, registrations, events, cards and rankings; own workspace when signed in |
| POST | `register`, `login`, `logout` | Accounts and eight-hour sessions |
| PUT | `profile` | Own organization details / optional affiliations |
| POST / PUT | `events` / `events/:id` | Create / edit owned event |
| POST | `events/:id/register` | Self/team/promoter participant entry, including guest profiles |
| POST | `events/:id/bouts` | Publish a registered matchup |
| PUT | `bouts/:id/result` | Save/correct result and record accounting |
| PUT | `rankings` | Admin-only ranked position update |
| GET | `rankings/template` | Populated XLSX template and fighter reference |
| POST | `rankings/import` | Validate/preview then confirm division upload |

Passwords use PBKDF2-HMAC-SHA256 with random salt; session tokens are stored as SHA-256 digests.
Cookies are HttpOnly/SameSite=Strict, with Secure enabled when the trusted hosting proxy reports
HTTPS. Mutations require the custom request header and reject a supplied cross-origin Origin.
Only the account owner and app admin see account email addresses. Display text is HTML-escaped.
Affiliations are currently self-declared, not approved or verified; directory profiles and event
registration names are public. New portal profiles remain sample-labelled in this prototype.

## Validation

```sh
python scripts/check_project.py
python -m unittest discover -s tests -v
node --check public/app.js
node --check public/admin.js
node --check public/portal.js
```

The project checker validates live content and the static fallback's structure. Exact live/static
export equality is optional: `python scripts/check_project.py --check-static-export`. A changing
portal database is expected to differ from the committed static snapshot. Export deliberately with
`scripts/export_content.py` only when preparing static content, then run that exact-parity check.

Automated integration checks cover linked and independent profiles, ownership/role denial, CSRF,
registration duplication/closure, guest entrants, result retry/correction accounting and audit rows,
ranking shifts, repeatable seeding, cookie login and HTTP/WSGI routes. Headless Chromium validation
also exercised all five logins, event editing, result correction and public views; no JavaScript
exceptions or page overflow at 360/390/768/1440px. Screenshots are local validation artifacts, not
repository assets. No third-party browser dependency is needed to run the application.

## First go-live options and remaining work

| Option | Supports | Limits |
| --- | --- | --- |
| Static public site | Public roster/rankings and exported content | No login, registration, live cards or result writes |
| Private hosted demo | This portal through `gunicorn main:app` | Ephemeral Render storage loses edits/accounts; public dummy credentials are unsuitable for live access |
| Real initial release | Portal on HTTPS with durable storage and backups | Requires the operational and product work below before accepting real registrations |

For a real initial release, use durable SQLite storage on a single suitable application host (or
plan a database migration separately), configure `RFC_DB_PATH`, test restores and migrations, and
serve behind a trusted HTTPS proxy. The Render free-tier blueprint now explicitly enables stakeholder demo mode and
has no persistent disk. See [RENDER_TESTING.md](RENDER_TESTING.md) for deployment instructions. Never deploy the local stdlib development server as a production server.
Provision a private admin outside public self-registration; remove dummy identities and demo
credential controls. Add login/registration rate limiting, verified email and password recovery,
account suspension/moderation, gym/coach affiliation approval, consent/privacy/legal terms and
sports eligibility checks (age, medical clearance, weight and promotion rules). Decide whether
result publication needs approval and how official record baselines/ranking policy are verified.

This demo does not implement payments, automatic brackets, weigh-ins, bracket seeding, live scoring,
notifications, eligibility approval, entry withdrawal, bout editing/cancellation, or promotion-team
staff accounts. The Smoothcomp-inspired scope is the event workspace, participant counts/list,
registration and published cards—not a replicated competition engine. No deployment was performed.
