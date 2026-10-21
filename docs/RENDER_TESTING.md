# Render stakeholder testing and Excel rankings

Updated 2026-10-21. The Render configuration is prepared and locally rehearsed with Gunicorn.
This task has not deployed it to Render.

## Deploy on Render

For a new service, push these changes to GitHub and create a Render Blueprint from `render.yaml`.
For an existing dashboard-managed service, set the following manually before deploying the updated
repository (changing YAML alone might not update an existing service):

| Setting | Value |
| --- | --- |
| Build command | `pip install -r requirements.txt` |
| Start command | `gunicorn main:app --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 60` |
| Health check | `/api/health` |
| `PYTHON_VERSION` | `3.12.7` |
| `RFC_DEMO_MODE` | `1` |
| `RFC_DB_PATH` | `/tmp/rfc-demo.sqlite3` |

The explicit demo flag creates/reuses all five dummy accounts and their connected event on startup.
Default startup without that flag does not provision dummy users or show demo sign-in shortcuts.
A new runtime database is copied from the shipped seeded roster, then migrated; the tracked database
is preserved. Existing schema-v4 databases are no longer re-seeded during initialization, so edited
rankings and portal content survive ordinary process restarts on retained storage. Demo seeding does
not reset existing passwords, results or event edits.

Render free-tier storage is ephemeral. Changes/accounts/uploads can reset on restart or redeploy;
the sample accounts/event return on a fresh instance. The portal displays a stakeholder-demo banner.
Use sample data only. For retained testing, attach a persistent disk on a suitable Render plan and
point `RFC_DB_PATH` there. Public dummy credentials must not be used for real registrations.

## Demo login and walkthrough

Open **Member portal** from desktop navigation or the mobile menu, choose **Sign in / Register**,
and expand **Try a demo account**. Choose a role and sign in. All accounts use **`RfcDemo2026!`**.

| Role | Email | What to try |
| --- | --- | --- |
| App admin | `admin@demo.rfc.test` | Member overview; manual rankings; Excel template/upload |
| Promoter | `promoter@demo.rfc.test` | Demo Rumble Promotions; create/edit events, entrants, cards/results |
| Fighter | `fighter@demo.rfc.test` | Demo Alex Fighter; linked gym/coach; event entry |
| Gym | `gym@demo.rfc.test` | Demo Emerald Gym; register affiliated fighters |
| Coach | `coach@demo.rfc.test` | Demo Casey Coach; gym affiliation and fighter entries |

As promoter, open **RFC Demo · First Bell**: two registered fighters, including **Demo Jordan Guest**
(no login), and one published bout. Record a win, then correct it to a draw/no contest. Both fighters'
records update atomically; repeat saves do not double-count. Public event and athlete pages show
cards/history on refresh. New independent fighters/coaches and separate promotions can register.
The app admin above is separate from the legacy `/admin.html` CMS password, which stays disabled
unless independently configured. Use the member portal for the stakeholder walkthrough.

## Excel template and upload

As app admin, open **Upload Excel rankings** and click **Download Excel template**. A sample is also
included at [templates/RFC-rankings-template.xlsx](templates/RFC-rankings-template.xlsx). Prefer a
fresh download after adding fighters because it includes current IDs and positions.

The workbook includes:

- **Rankings**: editable `athlete_id`, `name`, `division`, `position` columns, populated from existing standings.
- **Fighters**: all current fighter IDs, exact names/divisions and current positions, including unranked fighters.
- **Instructions**: upload rules and publication steps.

Keep the fighter's ID/name/division together and edit positions. To add an unranked fighter, copy its
ID/name/division from Fighters. Each division needs unique consecutive whole-number positions from 1.
Do not use formulas/macros. Save as `.xlsx`, up to 512 KiB and 2,000 ranking rows.

Choose the file and click **Validate & preview upload**. Review old/new positions and any named
removals, then click **Confirm & publish rankings**. Preview does not write. Publication atomically
replaces only represented divisions. Omitted divisions stay unchanged; fighters omitted from an
included division become unranked. Empty files, bad IDs, mismatched names/divisions, duplicates,
position gaps and formulas are rejected with no partial writes. A stale preview must be regenerated
if someone changed rankings meanwhile. Uploading rankings does not change fighter W/L/D records.

## Validation and final hosted check

Install requirements for Excel support and Gunicorn, then run:

```sh
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
python scripts/check_project.py
node --check public/app.js
node --check public/admin.js
node --check public/portal.js
```

Integration tests cover roles, ownership, sessions, registration, guest entrants, record corrections,
legacy-editor protection, profile connections, rankings, workbook validation/preview/publication,
stale-preview rejection, repeatable seeds and HTTP/WSGI adapters. The startup test verifies uploaded
ranking removals are not re-seeded. Headless Chromium exercised all five logins, responsive layouts,
new registration, event entry/creation/editing, guest entry, card publishing and result correction.
Excel download/preview/publication and formula rejection were tested against Gunicorn.

After deploying, check health, all five logins, one event edit and one Excel preview on the actual
Render URL. Local Gunicorn tests do not establish Render deployment, hosted cookie behaviour or
cold-start availability. No payments, eligibility approval, email verification/recovery, automatic
brackets or real sporting-record verification are implemented in this stakeholder demo.
