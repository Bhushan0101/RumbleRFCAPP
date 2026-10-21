# Project structure and feature boundaries

## Current W.U.C.O application, payment and event workflow

The displayed brand is W.U.C.O. New fighters submit a private application, complete the EUR 10
application fee, then require administrator approval before public listing, ranking publication or
event registration. The Render stakeholder demo uses explicitly labelled TEST payments and PDF
receipts; no real money is charged. Admin workspaces now include fighter approval/profile management
and finance/date-filtered CSV reporting with separate live/test totals. Event entry supports category,
capacity and deadline checks, confirmation references and safe withdrawal. Schema version is 6.
See [WUCO_APPLICATIONS_PAYMENTS.md](WUCO_APPLICATIONS_PAYMENTS.md) for the full walkthrough, demo
logins, receipt retention and the separate Stripe/durable-storage requirements for real charging.
This current guide supersedes older descriptions below of instant registration or absent payments.


The application remains vanilla HTML/CSS/JavaScript with Python and SQLite. No frontend framework
or build step was added. Organize further work by domain rather than enlarging a single portal file.

## Server

| Path | Responsibility |
| --- | --- |
| `server.py` | Local HTTP/static transport and existing optional legacy CMS |
| `main.py` | Render/Gunicorn WSGI transport; delegates to the same portal API |
| `portal.py` | Session/authentication, account creation, scoped state composition and API routing |
| `portal_features/categories.py` | Shared active-category policy: Featherweight and Lightweight |
| `portal_features/fighters.py` | Fighter-owned metadata and invitation-based gym links |
| `portal_features/media.py` | Fighter-only photo validation, normalization and storage |
| `portal_features/events.py` | Promotion ownership, events, entries, bouts and atomic result accounting |
| `portal_features/organizations.py` | Existing gym/coach/promotion settings |
| `portal_features/rankings.py` | Manual ranked-position publication |
| `ranking_excel.py` | XLSX reference/template, validation, preview and atomic publication |
| `scripts/migrations/` | Ordered, additive schema changes; latest is 005 |

Both transports enforce the same role/ownership checks. Feature modules execute within the portal
transaction and reuse its validation/error helpers. New domains should keep their business rules in
a named feature module and add a small routing entry, not duplicate logic in HTTP and WSGI adapters.
The remaining account/auth/state code is intentionally centralized; split it further only when its
responsibility actually grows. Legacy `/api/admin/` is separate from the app-admin portal role.

## Member portal frontend

`public/portal.html` loads only `portal.css` and the module entry `portal.js`. It **does not** import
marketing `style.css`: the old public header media query caused the off-center desktop portal.
The marketing site retains its own structure and adopts the same monochrome/saffron palette.

| Module under `public/portal/` | Responsibility |
| --- | --- |
| `app.js` | Route/controller orchestration and event delegation |
| `state.js` / `api.js` | Shared live state binding and API transport |
| `shared.js` | Escaping, reusable fields, icons, avatars and feedback |
| `auth.js` | Sign-in, three-step fighter onboarding and separate organisation signup |
| `fighter.js` | Own profile, photo controls, gym card, registrations and history |
| `photos.js` | Client-side photo validation/resizing before transport |
| `rankings.js` | Category rankings and existing Excel preview controls |
| `events.js` | Existing event discovery/entry, cards, results and promoter event forms |
| `management.js` | Existing admin/gym/coach/promoter workspaces |

There is no directory screen or directory navigation. Old `#directory` bookmarks resolve to the
visitor's own account/profile. Selecting a gym uses its invitation code, not an exposed roster of gyms.
Rendering helpers escape user text. Keep authorization on the server; hiding controls is not access control.

## Next management areas

- **Fighter management:** own profile/onboarding is implemented; administrator review, eligibility,
  approval and category transfer policies can be added separately.
- **Event management:** current demo creation, entries, cards and results remain working; schedules,
  withdrawals, bout editing and official approval are future work.
- **Gym management:** current invitation code, profile and affiliated entries remain; verified
  membership requests and approval are future work.
- **Promotion management:** current independent promotion/event ownership remains; staff accounts,
  promotion-specific roles and wider operational tools are future work.

These are feature boundaries, not claims that the complete future management suite exists.

## Validation

```sh
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
python scripts/check_project.py
```

`tests/test_portal.py` uses isolated SQLite databases for domains, transport parity, privacy, category
policy and normalized photo ownership. It never rewrites the shipped SQLite database.

`tests/browser/fighter_journey.py` is an optional Playwright smoke test. Install Playwright in a
separate developer/test environment and provide Chromium. Start a disposable demo server first;
the script creates uniquely named sample accounts and event entries. It verifies the 3-step signup,
portrait, gym/coach connection, own profile editing, registration and category rankings, with layout
checks at 360/390/768/1440/1920px. `RFC_TEST_URL` overrides the default local port 8004;
`RFC_CHROMIUM_PATH` overrides `/usr/bin/chromium`. Browser tooling is not an application dependency.

## New application and finance modules

`portal_features/applications.py` owns paid review, status/approval guards and admin profile editing.
`payments.py` owns the fixed EUR 10 checkout, isolated simulator, provider reconciliation and signed
webhooks. `finance.py` owns PDF receipts, date-filtered reports and CSV. Frontend `payments.js` and
`administration.js` mirror those boundaries. Migration 006 adds durable ledger/audit records.
