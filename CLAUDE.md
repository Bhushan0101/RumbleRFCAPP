# Instructions for Claude / IDE coding assistants

Read this file first, followed by `docs/PROJECT_INTENT.md`, `docs/ARCHITECTURE.md`,
`docs/DATABASE.md`, `docs/EMAIL.md` and `docs/FUTURE_PLANS.md`.

## Project

**W.U.C.O. — World United Combat Organisation (Ireland)**: a responsive website and local member
portal for the national combat-sports federation. Public pages for rankings, fighters, clubs,
promoters and events; a member portal where fighters register and manage their profile; and gyms
run their own page, timetable and class bookings.

This is a working concept and portable local-development handover. The Python server is for local
dev and the Render stakeholder demo only — not a production platform.

## Preserve

- The W.U.C.O. brand: deep-green and gold palette, central tree-of-life mark flanking the
  "W.U.C.O" wordmark, condensed uppercase display type, dark event blocks.
- Responsive, accessible layouts: native dialogs, labelled controls, keyboard focus,
  reduced-motion support.
- Clear sample-content labelling until real information is supplied by the organiser.
- Existing working navigation, search, filters, detail dialogs, member login, and admin approval
  flow.

## Stack and commands

Vanilla HTML/CSS/JavaScript in `public/`. Standard-library Python server + SQLite. No npm build
step. Core workflows use stdlib; `requirements.txt` adds Pillow (photo uploads), openpyxl (Excel
rankings) and Gunicorn (Render hosting).

- Run locally: `python server.py` → http://localhost:8000
- Project check: `python scripts/check_project.py`
- Optional JS syntax check: `node --check public/app.js`
- Refresh static export: `python scripts/export_content.py`
- Tests: `python -m unittest discover -s tests -v`

## First-release scope (in progress)

1. **Fighter registration with Class.** Fields: First Name, Last Name, Martial Art, Class
   (J/N/L/C/B/A — see table below). Gym is optional at signup; a fighter may also request to
   join a gym after approval and the gym admin approves the request.
2. **Admin approval.** Admin sees new applications in the portal and approves/rejects. Approved
   fighters can log in. There is **no application fee** — the previous €10 subscription has been
   removed.
3. **Digital Fighter Passport.** Approved fighters get a fighter number (`IRL-000NNN`) and a
   public passport page (name, club, division, discipline, record, status, nationality, QR). An
   Apple Wallet `.pkpass` is parked — see `docs/FUTURE_PLANS.md`.
4. **Gym onboarding (admin-driven).** Public enquiry page `/gyms/join`. WUCO admin reviews
   enquiries and emails a one-time signed onboarding link. The gym fills in logo, hero,
   timetable image, structured classes, pricing products (Day / Week / Month / Per-class) and a
   Revolut handle. Admin approves and the coach account is created.
5. **Gym page + bookings.** Each gym has a public page with timetable image + structured class
   list. Fighters book single classes or buy passes via a Revolut redirect; the gym receives a
   notification on booking.
6. **Rankings & homepage** per the supplied design: central wordmark flanked by the tree-of-life
   mark, National Rankings tile, Upcoming Events tile, four action cards.

### Fighter Classes

| Code | Name     | Meaning                        |
|------|----------|--------------------------------|
| J    | J-Class  | Under 18                       |
| N    | N-Class  | Up to 5 recorded fights        |
| L    | L-Class  | Learning class                 |
| C    | C-Class  | No shin pads                   |
| B    | B-Class  | Debut pro                      |
| A    | A-Class  | Seasoned pro                   |

Class is an experience tier stored alongside weight division. Rankings remain filterable by
weight (-57, -60, -63, -65, -70, -72, -75, -80, -85, +85 kg).

## Email / notifications

No SMTP is wired. All outbound mail is **written to `logs/outbound_mail.log`** AND surfaced in
the admin portal inbox. See `docs/EMAIL.md`. Swap for real SMTP later by replacing the single
sender shim.

## Data rules

Working DB is `database/rfc.sqlite3` (filename retained; schema is WUCO). Back it up before
migrations. Do not delete/recreate the DB to change schema — add a migration under
`scripts/migrations/NNN_*.sql`. Preserve user edits; the initializer only restores missing
sample IDs.

Public API is read-only. Writes live under `/api/admin/*` (admin session cookie `wuco_session`)
or `/api/portal/*` (member session cookie `wuco_member`). Admin is disabled by default; set a
password with `python scripts/set_admin_password.py` (writes gitignored `admin_config.json`;
never under `public/`).

All DB-derived text is escaped at render (`esc`) and URLs validated (`safeUrl` client-side,
`v_url` server-side). Keep that invariant for every new rendered field or write path.

### Current feature flags

- `site_settings.gallery_enabled` / `news_enabled` default `'0'` — stories/gallery UI hidden.
  Re-enable in `site_settings` and re-add the `stories`/`gallery_items` entries to `SPECS` in
  `public/admin.js`.
- Instagram parked — see `docs/INSTAGRAM.md`.

## Technical boundaries

The Python server is local-dev / demo only — do not expose publicly as production. No
credentials ship with the project. Admin and SMTP (when added) credentials live only in
gitignored config or environment variables — never in frontend code or commits.

Do not introduce a framework, remote database, cloud dependency or paid provider (Stripe,
Apple Wallet, etc.) without a concrete need from the user. Keep existing features working while
improving the implementation.

## Do not invent

Do not fabricate real WUCO people, fights, results, partners, dates, records, contacts or legal
text. Replace samples only with content supplied by the organiser. Monarch Fight Academy is
seeded as the sample gym — timetable image is user-supplied, prices and Revolut handle are
placeholders.
