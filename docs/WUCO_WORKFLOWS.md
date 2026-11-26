# WUCO: Fighter & Admin Workflows

Current scope of the Next.js app at `app-next/`. This is the authoritative
walkthrough — `FIGHTER_JOURNEY.md` predates the Next.js rewrite and is kept
only for history.

- **Stack**: Next.js 16 (App Router), Prisma + SQLite, server actions, native
  dialogs. Local DB at `app-next/prisma/dev.db`.
- **Mail**: ZeptoMail HTTP (`lib/mail.ts`). In local dev every message is also
  written to `OutboundMail` and `logs/outbound_mail.log`.
- **Notifications**: in-app `Notification` rows + a header bell. Opening
  `/portal/notifications` marks everything read.

---

## 1. Fighter registration (4 steps)

Entry point: `/register`.

### Step 1 — Account
First name, last name, email (unique), password (min 10 chars).

### Step 2 — Disciplines
- Pick gender (Men's / Women's).
- Tick every discipline the fighter competes in: **Kickboxing**, **Muay Thai**,
  **Boxing**, **MMA**. Kickboxing and Muay Thai require a class
  (**J / N / L / C / B / A**); Boxing and MMA require a full class name.
- Mark exactly one discipline as **Primary**.
- Pick a **Weight division**. The division list follows gender + primary
  discipline (MMA divisions are gender-neutral placeholders).

### Step 3 — Details
- Date of birth (day/month/year selects, optional).
- Country (datalist of ISO countries).
- **Gym picker** — a dropdown of active WUCO clubs. Picking one queues a
  `GymJoinRequest` so the club admin sees the fighter in their portal after
  approval. If the gym isn't listed yet, pick *"My gym isn't listed…"* and
  type the name — admin sees this in the free-text `reviewNote` and follows
  up out of band.
- Coach name (free text — the primary instructor).
- **Declared record per discipline (optional)** — W / L / D fields. The row
  marked primary is mirrored onto `Athlete.wins / losses / draws` so public
  pages render the same number.

### Step 4 — Review & submit
Three required acknowledgements: **Terms**, **Privacy**, **Accuracy**. All
three must be ticked before the submit button is enabled.

### What the server does on submit (`registerFighter`)
1. Validates every field with zod (`app/actions/public.ts`).
2. In a single `prisma.$transaction`:
   - Creates a `PortalUser` with role `fighter`.
   - Creates an `Athlete` with the declared record on the primary discipline
     and class mirrored onto the Athlete.
   - Creates one `AthleteDiscipline` row per selected discipline.
   - Creates a `FighterProfile` with `approvalStatus = "pending_approval"`
     and a `reviewNote` capturing gym + coach text.
   - Creates an `ApplicationAudit` entry.
   - If the fighter picked an existing active gym: upserts a
     `GymJoinRequest` row scoped to that gym (status `pending`).
3. Sends two emails via ZeptoMail: `MAIL_ADMIN` + the applicant.

### What the fighter sees afterwards
A green "APPLICATION SUBMITTED" card with a link to the sign-in page. They
can sign in immediately with their credentials — portal content is gated on
`approvalStatus`.

---

## 2. Admin approval workflow

Entry point: `/portal/admin/fighters` (role `admin` only).

- Filter tabs: **All / Pending / Approved / Declined / Suspended**.
- **Free-text search** across fighter name, nickname, fighter number, user
  email/name, gym name. Preserves the active tab.
- Each application card shows:
  - Fighter name + fighter number (once issued).
  - Parsed Gym and Coach from `reviewNote` (older rows show "Not captured at
    signup" instead of a red alarm).
  - Country, DOB, Disciplines + declared records.
- Decision form: `pending_approval → approved | rejected | suspended`. A
  decline/suspension requires a `reviewNote`.
- On approve: `FighterPassport` is created, fighter number is minted
  (`IRL-000NNN`), and the fighter can log into the member portal.
- **Delete fighter permanently** is the danger-zone action.

---

## 3. What fighters can do post-approval

Entry point: `/portal` (member dashboard).

### `/portal/profile`
- **Fighter card panel** (left) with photo slot, name, nickname, primary
  discipline + class, all disciplines + records, division, country, W-L-D
  tiles, approval status.
  - **Add profile photo** button when empty → inline uploader.
  - **Change / Remove** once set — Remove has a confirm step.
  - Photos live under `public/uploads/fighters/` and are served from the
    `/uploads/fighters/...` URL.
- **View Digital Passport** button (public passport page at
  `/passport/<fighterNo>` with QR + PNG/PDF export).
- **View Rankings** button.
- **Your club** card (approved fighters):
  - Shows current linked club or "not affiliated yet".
  - Shows any pending outbound `GymJoinRequest`s as "Awaiting club approval".
  - "Browse clubs →" link to switch.
- **Club invites** card — inbound `ClubFighterInvite` rows with
  Accept/Decline. Accepting sets `FighterProfile.gymId`.
- **Edit your details** — name, nickname, country, biography, Instagram,
  Facebook, TikTok. Socials are validated via `lib/socials.ts` normalizers.
- **Photo gallery** — up to 20 `FighterPhoto` rows with optional captions,
  renders on the public `/fighters/[id]` page.
- **Injury information** — fighters declare current injuries or confirm none;
  answering counts toward completeness.
- **Verification requests** — free-text claims the admin can mark verified.
- **Account deletion request** — user-initiated, admin-processed.

### Profile completeness
Weight: 50 baseline (approved) + 15 photo + 15 injury info + 20 social link.
Four steps shown on the profile:
1. Application approved
2. Profile photo added
3. Injury information filled
4. Social link added

### `/rankings`
- Fighters see only the **top 10 of their own division** by default.
- "Request more rankings" button → persists a `RankingAccessRequest` + emails
  admin + drops a Notification into every admin's bell. Admin responds by
  sharing a signed 24h link (see **Admin: sharing rankings** below).
- Public (signed-out) viewers see the top 5 per division + a sign-in teaser.

### `/events`
- Browse upcoming / past events. Approved fighters can:
  - **Register interest** in an upcoming event (creates an
    `EventRegistration` with status `interested`).
  - **Accept / Decline** admin-sent bout offers (status `offered`).
  - **Confirm / decline** club-raised interest (status `pending_fighter`).

### Clubs
- Browse `/clubs`, view club pages.
- **Request to join a club** from its public page (writes a
  `GymJoinRequest`).

---

## 4. Admin workflows

Admin dashboard: `/portal` for a `role === "admin"` user.

### Fighter management → `/portal/admin/fighters`
See **section 2**. Approve / decline / suspend / delete; edit record + detail.

### Events & bouts → `/portal/admin/events`

- **Create event**: title, subtitle, start date, venue, city, cover photo,
  description, status (Upcoming / Live / Past).
- **Edit event** inline (also replace / remove cover photo).
- **Add bout (offer)**: `AdminAddBoutForm`.
  1. Pick **gender**.
  2. Pick **division** (filtered by gender).
  3. **Red corner** list filters to approved fighters in that
     gender + division. **Blue corner** then excludes red.
  4. Order + Card section (Main / Co-Main / Prelim).
  5. Click **OFFER BOUT →**. Two paired `EventRegistration` rows are
     written (status `offered`, shared `boutRef`); both fighters receive mail
     + Notification. Bout order + section are stashed on the offer.
- **Ready to publish** panel appears once both sides are `confirmed`. Admin
  clicks **PUBLISH ON CARD →** to create the real `Bout` row.
- **Fighter interest** panel shows every fighter who registered interest with
  their discipline / division / record. **Offer bout** opens a filtered
  opponent dropdown (division + primary discipline).
- **Record bout result** writes `BoutResult` and auto-updates each fighter's
  W-L-D.

### Rankings → `/portal/admin/rankings`
- Sport + gender + division selector.
- "Awaiting ranking" — approved fighters whose primary division has no
  Ranking row. Click to focus their row in the setter.
- Add / update / remove positions per division. Setting a position already
  occupied vacates the previous holder.
- Distinct empty states: "No fighters are currently registered in this
  division" vs. "No ranking set for this category yet — N eligible fighters
  below".

### Sharing rankings → `/portal/admin/ranking-requests`
When a fighter requests more rankings:
1. A Notification links admin to this page with `?open=<id>`.
2. A modal opens with the requester's details + a **Scope** dropdown:
   "Full national rankings" or any specific division from `ALL_DIVISIONS`.
3. **Share (24h) →** mints a `RankingShareToken` (32-byte base64url,
   24-hour TTL), updates the `RankingAccessRequest` to `resolved`, emails the
   requester a link at `/rankings/share/<token>`.
4. **Decline this request instead** sets `status = rejected`.
5. The public `/rankings/share/<token>` page validates the token and renders
   the scoped rankings via `RankingsFullTable`. Expired / revoked / unknown
   tokens → informational "Link expired" / "Link not found" states.

### Gym enquiries → `/portal/admin/gyms`
- Public enquiry form at `/clubs/join` writes `GymEnquiry`.
- Admin invites via `inviteGym` (creates `GymOnboardingToken`), club fills
  the onboarding form, admin approves → `Gym.status = "active"`.
- Followup Q&A per `GymEnquiryFollowup`.

### Account deletions / Verifications / News / Inbox
Admin-reviewed queues for user-initiated changes and newsroom publishing.
Inbox is a log of outbound mail (every send persists a row).

---

## 5. Clubs

Entry point: `/portal/club` (role `gym | coach | admin`).

- **Pending join requests** — from fighters applying via the club page.
  Approve (sets `FighterProfile.gymId`) or decline.
- **Invite a fighter** — searchable fighter list, send a `ClubFighterInvite`
  with an optional note. Fighter accepts from `/portal/profile`.
- **Raise event interest** — pick a member + an upcoming event. Writes an
  `EventRegistration` with status `pending_fighter`. Admin only sees it as
  `interested` once the fighter confirms on the event page.
- **Your fighters** list with their records.
- **Your fighters' rankings** grouped by division.
- **Head coach profile** — timetable/CV fields captured during onboarding.
- **Club gallery** — up to 40 photos on the public club page.
- **Danger zone** — request withdrawal from WUCO.

---

## 6. Data model shorthand

```
PortalUser ──┬── FighterProfile ──┬── Athlete ──┬── AthleteDiscipline (per discipline W-L-D)
             │                   │             ├── FighterPassport (fighterNo)
             │                   │             ├── Ranking (per division)
             │                   │             ├── FightHistory (declared)
             │                   │             ├── FighterPhoto (gallery)
             │                   │             └── EventRegistration (interest / offer / bout)
             │                   └── Gym (optional)
             ├── Gym (owner)
             ├── Coach
             ├── Notification
             ├── GymJoinRequest (fighter → club)
             ├── ClubFighterInvite (club → fighter)
             ├── VerificationRequest
             ├── AccountDeletionRequest
             ├── RankingAccessRequest (fighter asks for rankings)
             ├── RankingShareToken (admin-minted 24h link)
             └── PasswordReset
```

Events:
```
Event ──┬── EventRegistration (interest / offer / confirmed, shared boutRef)
        ├── Bout (published pair, with optional BoutResult)
        └── Promotion (optional promoter)
```

Mail: `OutboundMail` stores every send. The `MailCategory` field groups
them (fighter_signup, gym_join_request, class_booking, …).

---

## 7. End-to-end scenarios

### Fighter: first application → first bout
1. Open `/register`, complete the 4 steps.
2. Receive two emails (admin notified; applicant confirmation).
3. Admin approves in `/portal/admin/fighters`.
4. Fighter signs in → `/portal/profile`, adds a photo, fills injuries, adds
   an Instagram handle → completeness hits 100%.
5. Admin sets a ranking for the fighter's division.
6. Fighter browses `/events`, clicks **Register interest** on an upcoming
   event.
7. Admin opens that event in `/portal/admin/events`, sees the interest row
   with discipline/division/record. Clicks **Offer bout**, picks the division
   → opponent dropdown narrows to eligible fighters. Sends offer.
8. Both fighters accept from the event page. Status flips to `confirmed`.
9. Admin sees **Ready to publish** panel → **PUBLISH ON CARD →**. Bout joins
   the fight card.
10. After the fight, admin opens **Record bout result**. W-L-D updates on
    both fighters automatically.

### Fighter asks for rankings they can't see
1. Fighter clicks **Request more rankings** on `/rankings`.
2. `RankingAccessRequest` is written, admin mailed + bell notification.
3. Admin clicks notification → modal auto-opens on
   `/portal/admin/ranking-requests?open=<id>`.
4. Admin picks "Full national rankings" (or a specific division) → **Share (24h) →**.
5. Fighter receives email with `/rankings/share/<token>` link, opens it, sees
   the view. After 24h the link renders "Link expired".

### Club recruits a fighter
1. Club owner opens `/portal/club` → **Invite a fighter**, searches, sends.
2. Fighter sees **Club invites** on `/portal/profile`, Accepts.
3. `FighterProfile.gymId` is linked; the club owner is notified
   (bell + email).

### Club raises event interest on a fighter's behalf
1. Club picks member + event in `/portal/club` → **Raise event interest**.
2. Fighter sees **"Your club wants to put you forward"** card on the event
   page and **Confirm interest** (or **Not this one**).
3. On confirm, the registration flips to `interested` and the admin sees it
   in `/portal/admin/events` like any other interest row.
