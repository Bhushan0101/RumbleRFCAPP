# Fighter registration and rankings walkthrough

## Current W.U.C.O application and event workflow

New fighters submit a private application; an administrator reviews and approves (or rejects) it before
public listing, ranking publication or event entry. **There is no application fee** — the previous
€10 payment flow has been removed (migration 007). Event entry supports category, capacity and deadline
checks, confirmation references and safe withdrawal. Schema version is 7. See
[FUTURE_PLANS.md](FUTURE_PLANS.md) for provider payments and Apple Wallet, both intentionally parked.


Current scope: fighter onboarding/profile and category rankings. The interface is black and white
with saffron accents; the portal has its own centered, responsive design system.

## New fighter: end-to-end test

1. Open **Member portal → Join RFC**. You should see one centered registration card and three steps.
2. **Account:** enter your full name, an unused email and a password of at least 10 characters.
   Select **Continue**. Nothing is registered yet.
3. **Fighter profile:** choose **Featherweight** or **Lightweight**, enter your country, and optionally
   add a JPEG/PNG/WebP portrait. A preview appears. Camera originals up to 10 MB are resized before upload.
4. To connect a gym, expand **Connect my gym**, enter the invitation code supplied by your gym,
   and select **Find gym**. The matching gym and its coaches appear. Pick a coach if relevant.
   Without a code, you register as an independent fighter. No gym directory is shown.
5. **Review:** check your name, email, category, country and gym, then select **Create fighter account**.
   The account is created, signed in, and your photo uploaded if selected. If the photo alone fails,
   the account remains usable and the message asks you to retry the photo from your profile.
6. You land on **My profile**. Expect your own name/category/country, W–L–D of 0–0–0 for a new fighter,
   and **Not ranked yet** until the app administrator publishes a position. Registration does not
   create a ranking or invent fight results.
7. Update nickname/biography and select **Save profile**. Refresh: the saved values remain.
   Use the separate **Fighter photo → Choose a photo → Upload photo** controls to replace the portrait.
8. **My gym** shows only your linked gym and coach. Another gym is not visible in the fighter's
   workspace or its state API. To switch gyms, enter the new invitation code; to unlink, save an empty
   code and coach. A ranked fighter's category change requires administrator reconciliation.
9. Open **Events**, choose an open upcoming event, select yourself and register. The count increases
   once. Back in **My profile**, the event appears under **My event registrations**. Duplicate entries
   do not add another registration. Promoters continue to manage cards/results through their workspace.
10. Open **Rankings**. There are exactly two category tabs: Featherweight and Lightweight. Positions
    come from published ranking rows; the list shows photos, names and records. Your row is marked
    **YOU** if ranked. Administrators retain manual position editing and Excel preview/publication.

To obtain the sample gym code, sign in as `gym@demo.rfc.test` with `RfcDemo2026!`. Its workspace
shows **Your gym invitation code**. Sign out before creating the fighter. These are public sample
credentials for the explicit stakeholder-demo mode only.

## What to expect on Render

Existing demo accounts and existing data are preserved by migration 005. It adds unique invitation
codes to gyms; it does not delete historical athletes or divisions. Welterweight is retained in
storage but is not offered for new fighter registration, portal ranking publication or Excel templates.
The public rankings page likewise shows only the two active categories.

Deploy with the same settings in [RENDER_TESTING.md](RENDER_TESTING.md). The updated requirements
include Pillow for independent server-side image decoding. Photos are normalized to JPEG, resized,
and stripped of original metadata; malformed images, SVGs and oversized payloads are rejected.
A fighter can update only their own photo/profile. Fight records remain result-managed.
Render free-tier database edits and uploaded photos can reset after redeploy/restart. Durable uploads
need persistent storage in a future hosting configuration, in addition to a persistent database.

## Regression checks

- At 360, 390, 768, 1440 and 1920 pixels, no page-wide overflow; header and content use the same center.
- On a 1920px display, the header stays full-width with centered contents: no inherited floating transform.
- Signed-out visitors cannot browse a gym/coach directory; fighters receive only their own gym details.
- New registrations and profile category selections accept only Featherweight/Lightweight server-side.
- Upload a valid portrait, then try a non-image: only the valid upload changes the portrait.
- Register without a gym/photo: the independent profile still works and the page offers clear next steps.
- Existing admin Excel uploads, promotion ownership, event entries and result corrections still work.

Automated backend checks: `python -m unittest discover -s tests -v` after installing requirements.
Optional browser test: `tests/browser/fighter_journey.py` against a disposable demo server; see
[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for the development layout and test requirements.
