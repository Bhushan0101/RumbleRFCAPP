# Instagram & Gallery — current state (parked)

## Current W.U.C.O application and event workflow

New fighters submit a private application; an administrator reviews and approves (or rejects) it before
public listing, ranking publication or event entry. **There is no application fee** — the previous
€10 payment flow has been removed (migration 007). Event entry supports category, capacity and deadline
checks, confirmation references and safe withdrawal. Schema version is 7. See
[FUTURE_PLANS.md](FUTURE_PLANS.md) for provider payments and Apple Wallet, both intentionally parked.


**Status: built, then switched OFF by request.** Nothing was deleted — the feature is behind
flags and can be re-enabled without new code.

## What exists

- **Public Gallery page** (`#gallery` in `public/app.js`, `galleryPage()`): shows Instagram reels and
  YouTube/Rumble videos as link-out tiles, with a search box over the Rumble videos.
- **Instagram / YouTube URLs** live in `site_settings` (`instagram_url`, `youtube_url`) and are
  editable in the admin **Settings & flags** tab.
- **`gallery_items` table** (migration `002_gallery.sql`): seeded with 8 clearly-labelled sample
  entries (3 Instagram reels, 1 YouTube, 4 searchable Rumble videos).
- The admin CRUD panel for gallery items and for news/stories was **removed from the admin UI**
  (see `SPECS` in `public/admin.js`) so organisers can't edit parked content by accident. The write
  API endpoints still exist server-side.

## What "off" means right now

- `site_settings.gallery_enabled = '0'` and `news_enabled = '0'`.
- The frontend hides the **Gallery** and **News** nav links and routes (requests to `#gallery` /
  `#news` fall back to Home), and the News-dependent home sections are hidden.
- The admin panel does not list Gallery or Stories collections.

## How to turn it back on later

1. In admin **Settings & flags**, set `gallery_enabled` and/or `news_enabled` to `1` (or update the
   rows in `site_settings` directly).
2. To let organisers edit that content again, re-add the `gallery_items` and `stories` entries to
   `SPECS` in `public/admin.js` (the field lists are preserved in git history / this note):
   - `stories`: `title*, type, body*, image_url, video_url, published_at, is_sample, display_order`
   - `gallery_items`: `platform*, kind*, title*, url*, thumbnail_url, description, is_sample, display_order`
3. Re-run `python scripts/export_content.py` so the static fallback reflects the flags.

## What was intentionally NOT built

- **Live Instagram feed embedding.** Showing real reels inline needs Meta's embed/Graph API — a cloud
  dependency, an account, and (for the Graph API) a token. Out of scope for this offline, dependency-
  free concept. The current design is link-out tiles, which need no API.
- Auto-pulling the latest posts. If wanted later, that is an opt-in integration to design separately
  (server-side fetch + caching, with the token kept out of frontend code).
