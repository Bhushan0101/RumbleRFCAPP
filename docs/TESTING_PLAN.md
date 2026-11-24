# WUCO Ireland — Testing Plan (Beta)

**Scope:** Manual end-to-end tests for every user-facing and admin feature.
**Environment:** Local Next.js dev server at `http://localhost:3000`.
**Pair with:** `WEBSITE_STATUS.md` (feature inventory + email routing matrix).

## Before you start

1. Server: `cd app-next && npm run dev` → confirm `HTTP 200` at `http://localhost:3000`.
2. Seed state: run `npx prisma db seed` in `app-next/` if DB is empty. Admin: `admin@wuco.ie / WucoAdmin2026!`.
3. Two real inboxes you can read:
   - `admin@wucoireland.ie` (admin notifications)
   - A personal email (to receive fighter-facing confirmations / passport card)
4. Live log tail (optional, for email debugging):
   ```
   tail -f app-next/logs/outbound_mail.log
   ```

---

## 1. Public site — anonymous user

### 1.1 Beta ribbon
- [ ] Load `/` → the black ribbon with "**BETA · Limited release — features may change without notice**" is visible above the main header.
- [ ] Ribbon appears on every page (`/rankings`, `/fighters`, `/news`, `/clubs`, `/events`, `/register`).

### 1.2 Homepage rankings tile
- [ ] Rankings tile shows categories (MEN / WOMEN / JUNIORS) and discipline chips (ALL / KICKBOXING / BOXING / MMA / BJJ).
- [ ] Switching tabs changes the sidebar weights:
  - MEN + any boxing/kickboxing → `57 · 60 · 63 · 67 · 70 · 72 · 75 · 80 · 85 KG`
  - WOMEN + any boxing/kickboxing → `55 · 57 · 60 · 62 KG`
  - MMA or BJJ → hides the MEN/WOMEN/JUNIORS tabs, shows `FEATHERWEIGHT · LIGHTWEIGHT`
- [ ] Table lists ranked athletes for the active combination, or shows "No ranked fighters in this filter yet."
- [ ] Clicking any ranked fighter navigates to `/fighters/[id]`.
- [ ] "VIEW FULL RANKINGS →" link carries filter state in the URL.

### 1.3 Homepage action cards
- [ ] All four cards render the correct images:
  - JOIN AS A FIGHTER → `/brand/join-fighter.png`
  - REGISTER YOUR CLUB → `/homepage/join-club.png`
  - BECOME A PROMOTER → `/homepage/become-promoter.png`
  - FIGHT RECORDS → `/homepage/fight-records.png`
- [ ] Each CTA button goes to the right route.

### 1.4 Navigation
- [ ] Nav shows: Home · Fighters · Clubs · Promoters & Events · **News** · About Us.
- [ ] "News" opens `/news`.
- [ ] Member Login button in header → `/portal/sign-in`.

---

## 2. Fighter registration

### 2.1 Step 1 — Account
- [ ] Load `/register`.
- [ ] Try to click Next with empty fields → each field shows a browser validity message.
- [ ] Fill first name, last name, email, password (10+ chars) → Next works.

### 2.2 Step 2 — Discipline
- [ ] Gender radio shows Men/Women.
- [ ] Choosing a martial art updates both:
  - the Division dropdown (BJJ/MMA → legacy; Kickboxing/Boxing → gendered)
  - the Class radio group (BJJ has none; Kickboxing shows J/N/L/C/B/A; Boxing/MMA show Amateur/Novice/Intermediate/Elite/Open/Pro)
- [ ] Enter key advances to step 3.

### 2.3 Step 3 — Review & submit
- [ ] Country field is a dropdown; typing "ind" shows India, Indonesia, etc. Default is Ireland.
- [ ] Date of birth = three separate dropdowns (Day / Month / Year). Day count shrinks for February (test with month=Feb, year=2024 → max day 29).
- [ ] Record fields default 0 and accept integers.
- [ ] **Enter key** inside any input/select on step 3 does NOT submit the form.
- [ ] Only the green "CREATE FIGHTER APPLICATION →" button submits.
- [ ] After submit, the whole form area replaces with the **APPLICATION SUBMITTED** panel: big ✓, submitted → review → passport issued status steps, "Sign in to member portal →" link.

### 2.4 Emails on signup
- [ ] `admin@wucoireland.ie` receives **"New fighter signup: <name>"** from `info@wucoireland.ie`.
- [ ] The registrant's email receives **"W.U.C.O: your fighter application was received"** with the branded green/gold card and their submitted details.
- [ ] Both lines appear in `app-next/logs/outbound_mail.log`.
- [ ] Both are visible in admin inbox at `/portal/admin/inbox`.

---

## 3. Admin review

### 3.1 Approve
Sign in as `admin@wuco.ie / WucoAdmin2026!`.

- [ ] `/portal/admin/fighters` lists the pending application.
- [ ] Click **Approve** → the row flips to Approved, a passport number `IRL-000XXX` is issued.
- [ ] Email arrives at registrant's inbox: **"W.U.C.O: your fighter passport IRL-000XXX is live"** with the HTML passport card and "VIEW LIVE PASSPORT →" link.
- [ ] Clicking the passport link opens `/passport/IRL-000XXX` with the correct data.

### 3.2 Rejection / suspension
- [ ] Reject another pending fighter → their email receives plain-text "your application was rejected" with the admin note (if any). No passport card.
- [ ] Suspend an approved fighter → email says "suspended". Passport page still renders (status badge turns orange).

### 3.3 Peer notification on approval
- [ ] Approve a second fighter in the **same gender + division + martial art** as the first.
- [ ] Sign in as the first fighter → bell icon in header shows a red badge.
- [ ] Click the bell → `/portal/notifications` lists "New fighter in your division: <name>".
- [ ] Mark-all-read clears the badge.

---

## 4. Fighter portal (approved fighter)

Sign out, then sign in as the approved fighter.

### 4.1 Dashboard
- [ ] `/portal` shows the green Fighter Card with their name, passport number, discipline, class, division, record.
- [ ] A **Profile completeness** card shows 50% with:
  - ✓ Application approved
  - ○ Profile photo added
  - ○ Injury information filled
  - ○ At least one fight history entry
- [ ] The **Notifications** tile sits to the right; shows unread count if any.

### 4.2 Profile page
Click "EDIT PROFILE →".

- [ ] Completeness bar shows at the top.
- [ ] Edit name/nickname/country/bio → "Profile saved."
- [ ] **Profile photo**: file picker labelled "JPG, PNG, WEBP or GIF — up to 8 MB. Tap to open camera on mobile."
  - Upload any image → preview appears, then click Upload → "Photo updated."
  - Refresh `/portal` → photo shows on the fighter card. Also on `/passport/[fighterNo]`.
  - Completeness bar: now 65% (approved 50 + photo 15).
- [ ] **Injuries**: pick Yes → details textarea appears. Describe injury → Save → "Injury information saved."
  - Completeness: 80% (adds 15).
- [ ] **Fight history**: initial form shown when no entries.
  - Fill in date + opponent + result + method → Add fight.
  - Row appears with coloured result badge.
  - **Fighter's dashboard record (W-L-D) updates** to reflect only the entries you added.
  - Completeness: 100%.
  - Add a second entry → record updates again.
  - Remove an entry → record recounts.

### 4.3 Support request (with priority)
- [ ] Open the user avatar dropdown → "Get support".
- [ ] Priority radios: Low (grey) · Normal (green, default) · High (gold) · Urgent (red).
- [ ] Submit a High-priority test → success toast.
- [ ] `admin@wucoireland.ie` receives **`[HIGH] Support request from <name>: <subject>`**.
  - HTML email has a gold banner "**PRIORITY: HIGH**" at the top.
- [ ] Submit an Urgent one → subject starts `[URGENT]`, banner is red.

### 4.4 Correction request
- [ ] From the profile page, "Request a correction" → modal → submit.
- [ ] `info@wucoireland.ie` (NOT admin) receives the correction email.

---

## 5. Public passport verification

- [ ] Open `/passport/IRL-000XXX` in an incognito window (no auth).
- [ ] Page renders with: WUCO wordmark, fighter name, club (or Independent), division, discipline, class, record, status, nationality, Irish flag strip, fighter number, QR code.
- [ ] Scan the QR with a phone → opens the same passport URL.

---

## 6. Admin — news

Sign in as admin.

- [ ] `/portal/admin/news` shows the posts list.
- [ ] Click **+ NEW POST** → fill title, summary, body. Choose Draft → Create → listed with DRAFT badge.
- [ ] Open `/news` publicly → draft does **not** appear.
- [ ] Edit the draft → flip to Published → Save. Reload `/news` → post appears with card.
- [ ] Click into `/news/[slug]` → full body renders (line breaks preserved).
- [ ] Delete the post from the admin list → gone from both admin and `/news`.

---

## 7. Public — Join as a Club

- [ ] Open `/clubs/join` → form has name, contact name, contact email, phone (optional), city, message.
- [ ] Submit valid form → "Thanks — your enquiry has reached the W.U.C.O admin team."
- [ ] `admin@wucoireland.ie` receives **"New gym enquiry: <club name>"** with contact details and message.
- [ ] Row appears in `/portal/admin/gyms` as a pending enquiry.
- [ ] From admin, click **Invite** → an onboarding email with a signed link is sent to the gym contact.
- [ ] Open the link in another browser → fill onboarding → submit → "Thanks — your onboarding is in."
- [ ] Admin receives "Gym onboarding submitted: <name>".
- [ ] In admin, approve the onboarding → the gym contact receives "Your W.U.C.O gym page is live" with temp password.
- [ ] Sign in with the gym contact email + temp password → coach account works.

---

## 8. Public — events

- [ ] `/events` lists events (seed populated some if the DB was seeded fresh).
- [ ] Click an event → `/events/[id]` shows title, venue, date, categories, bouts.
- [ ] Admin: `/portal/admin/events` can create, edit, add bouts, publish.

---

## 9. Email delivery sanity

- [ ] Every scenario above also writes a row to `outbound_mail` visible in `/portal/admin/inbox`.
- [ ] If ZeptoMail is offline, local log at `app-next/logs/outbound_mail.log` still captures the message (fire-and-forget).
- [ ] Nothing hangs the user: a signup response should return in <1 second even if SMTP/API is slow.

---

## 10. Regression checks after any code change

Fast checklist before claiming "works":

1. `cd app-next && npx tsc --noEmit` — zero errors.
2. Server starts clean: `npm run dev` → no red errors in console.
3. Register a dummy fighter + approve + delete → no stray rows in DB.
4. Admin inbox at `/portal/admin/inbox` contains the expected lines.

---

## Known Beta limitations (do not test as bugs)

- No real payment flow for class bookings (Revolut handle only).
- No Apple Wallet .pkpass yet.
- No Instagram feed.
- No automatic class escalation from recorded fights.
- No multi-language.
- Header search icon is cosmetic — no search endpoint.
- Rankings table shows empty for women/juniors/MMA/BJJ until real data is loaded.
