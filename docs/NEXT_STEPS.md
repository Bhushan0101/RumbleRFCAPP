# Continuation and acceptance criteria

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


## Finished in this export

- [x] Full portable frontend and all local assets.
- [x] Six section routes and responsive CSS.
- [x] Search/filter/tab/modal interactions implemented.
- [x] SQLite file, schema, seeds and safe initializer.
- [x] Local read API connected to core content.
- [x] Static JSON export/fallback.
- [x] Claude context and original design references.

## Next implementation work

- [x] Read actual rankings position/movement rows in the rankings view.
- [x] Connect public event fight cards and athlete bout history.
- [ ] Connect remaining achievements, media and sponsor fields.
- [ ] Replace sample content with approved RFC content.
- [ ] Add real date/time display and countdown when dates are known.
- [ ] Connect verified external ticket booking URL; do not add payment collection by assumption.
- [ ] Add approved contact and policy text.
- [x] Add an authenticated CMS (optional local admin write API at `/api/admin/*`, disabled until a password is set).
- [x] Escape database text and validate URLs before enabling untrusted content management (done: `esc`/`safeUrl` on render, server-side field + URL validation).
- [x] Gallery page: Instagram reels + YouTube/Rumble videos (link-out tiles) with search over Rumble videos; IG/YouTube URLs in settings. Currently feature-flagged OFF; Instagram parked (docs/INSTAGRAM.md).
- [x] Athlete flip-cards (portrait front, cartoon back), admin image upload, and CSV bulk import of athletes.
- [ ] Move generated/repeated images to approved athlete/event assets.

## Manual browser QA

At 360px, 390px, 768px and 1440px: no horizontal overflow, logo/navigation do not overlap, headings and buttons remain legible. Test mobile menu with keyboard, route changes and active links. Open/close dialogs with the close button and Escape; confirm focus returns. Search for a known athlete and a nonexistent name; combine division/country filters. Test upcoming/past event tabs, all news categories and title sorting. Check static fallback with a separate static server after exporting JSON.

## Data acceptance

All real claims must be approved. Verify records and athlete identities; confirm ticket URLs, event timezone and venue. Do not remove sample banners while sample content remains. Add backup/migration workflow before editing production data.
