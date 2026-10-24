# W.U.C.O Ireland — Status

_Last updated: 2026-10-24_

A living document of what's shipped, what's planned, and what's parked.
This file is intentionally kept short — see `docs/` for deep dives.

---

## TL;DR

- **Stack:** Next.js 16 (App Router) · TypeScript strict · Tailwind v4 · Prisma + SQLite · NextAuth v5
- **State:** Public site, member portal, admin workspace, ranking-admin workspace, Fight-Day live-results, Digital Fighter Passport — **all working end-to-end**
- **Target host:** Cloudflare / Render — a `render.yaml` is checked in and `next build` produces a standalone bundle. First deploy is one `New Blueprint` click away.
- **Legacy:** The original Python/stdlib prototype at the repo root is kept archived for reference; the production app is `app-next/`.

---

## Active (live, tested)

### Public site
| Route | Purpose |
|---|---|
| `/` | Homepage: hero · quick services · rankings panel · upcoming events panel · action cards · emerald stats bar |
| `/rankings` | National rankings by division with 🥇🥈🥉 top-3 medals |
| `/fighters`, `/fighters/[id]` | Approved fighter directory + profile |
| `/clubs`, `/clubs/[slug]` | Club directory + public gym pages (timetable grid, products, booking) |
| `/clubs/join` | Public gym enquiry form |
| `/clubs/onboarding?token=…` | Token-gated onboarding form for invited clubs |
| `/events`, `/events/[id]` | Event listing + detail with **LIVE** pulse badge for in-progress events |
| `/promoters`, `/promoters/join` | Promoter info |
| `/register` | Fighter signup (with declared record + optional notes) |
| `/passport/[fighterNo]` | Digital Fighter Passport card with real QR |
| `/api/passport/[fighterNo]` | Public JSON for QR verification |
| `/about`, `/contact`, `/privacy`, `/terms`, `/robots.txt`, `/sitemap.xml` | Content & SEO |

### Member portal (auth-gated)
| Route | Role |
|---|---|
| `/portal/sign-in` | Public |
| `/portal` | Any member — fighter dashboard OR admin dashboard OR ranking-admin redirect |
| `/portal/profile` | Fighter — edit own name/nickname/country/bio + Request a correction (emails admin) |

### Admin workspace (role=`admin`)
| Route | Function |
|---|---|
| `/portal/admin/fighters` | Review applications · approve/reject/suspend · edit full fighter profile + record |
| `/portal/admin/gyms` | Review enquiries · send onboarding links · approve (creates coach account + temp pw) |
| `/portal/admin/events` | Create/edit/delete events · record bout results |
| `/portal/admin/rankings` | Set positions per division (compacts gaps automatically) |
| `/portal/admin/inbox` | Outbound mail log (every notification visible) |

### Ranking admin workspace (role=`ranking_admin`, scoped)
| Route | Function |
|---|---|
| `/portal/ranking` | Two-tile landing: Ranking Administration + Fight Day. Shows LIVE events + Coming Soon events. |
| `/portal/ranking/events/[id]` | **Fight Day** bout management: tick winners inline, auto-updates fighter records (reversible), flip event Live↔Past |
| `/portal/admin/rankings` | Same as admin rankings editor |
| ❌ All other `/portal/admin/*` | Redirects away — ranking admins can't see fighters/gyms/inbox |

### Data model (Prisma)
Tables: `portal_users` · `portal_sessions` · `athletes` · `fighter_profiles` · `fighter_passports` · `application_audit` · `gyms` · `coaches` · `gym_products` · `gym_classes` · `class_bookings` · `gym_join_requests` · `gym_enquiries` · `gym_onboarding_tokens` · `promotions` · `events` · `event_registrations` · `bouts` · `bout_results` · `rankings` · `outbound_mail` · `site_settings`

### Server actions
- **Public:** fighter signup, gym enquiry, class booking, onboarding submit
- **Auth:** sign in, sign out
- **Admin:** approve/reject fighter, edit profile+record, invite gym, approve gym (creates coach account), create/edit/delete events, record bout result
- **Ranking admin:** add bout, settle bout (atomic, reversible), flip event status
- **Fighter:** edit own profile, request correction, support request

### Auth
- NextAuth v5 credentials provider
- PBKDF2-SHA256 (200k iterations) — matches the legacy Python app so users migrate cleanly
- JWT session cookie, 8-hour lifetime
- Roles on the token: `admin` · `ranking_admin` · `promoter` · `gym` · `coach` · `fighter`

### Mail
- Log-only sender writes to `logs/outbound_mail.log` + `outbound_mail` DB table
- Admin inbox at `/portal/admin/inbox`
- Categories: fighter_signup · fighter_approved · fighter_rejected · gym_enquiry · gym_onboarding · gym_submitted · gym_approved · gym_join_request · class_booking
- SMTP integration is one function swap away (Resend, SendGrid, Mailgun, SES) — see `lib/mail.ts`

### Design system
- Deep forest green (`#07251b`) · metallic gold (`#D8AE5C`) · emerald (`#006B4F`)
- Rounded corners everywhere (pill buttons, 2xl cards)
- Barlow + Barlow Condensed via `next/font` (self-hosted, no FOUT)
- Dark cinematic hero · cream header with gradient fade
- Fully responsive (430 / 768 / 1024 / 1440+)
- Real WUCO brand lockup with the gold diamond, transparent background

### SEO & performance
- `metadata` API on every route with Open Graph defaults
- `sitemap.xml` auto-generated from DB rows (fighters, gyms, events, passports)
- `robots.txt` disallows `/portal` and `/api`
- Standalone build output for small deploy footprint

---

## Planned (next sprint)

### High priority
- **Gym admin workspace** (role=`gym` or `coach`) — manage own gym page content, upload timetable image + logo + hero via Supabase Storage or equivalent, CRUD classes/products, approve fighter join requests
- **Postgres migration** — swap `provider` in `schema.prisma`, run `prisma migrate dev --create-only` + commit, point `DATABASE_URL` at Supabase/Neon/Render Postgres
- **Email provider** — swap `sendMail` body for Resend (free tier generous, Next-native)
- **Rate limiting** on public write endpoints (fighter register, gym enquiry, class booking) — upstash/redis or in-memory LRU
- **Image uploads** — athlete portraits, gym logos, event posters. Right now these are reference images; prod needs Supabase Storage buckets + optimistic preview

### Medium priority
- **About Us page** rewrite from the WUCO 2026 info pack (pending PDF)
- **Fighter dropdown items wired** — Championships route, Promoter Directory listing page
- **Automated tests** — Playwright E2E suite running the full fighter + gym + fight-day loops; already have deterministic seed
- **Email verification on signup** — currently signups are open; add a token-based verification step

### Low priority / future
- **Apple Wallet pass** (`.pkpass`) — see `docs/FUTURE_PLANS.md` from the legacy app; needs an Apple Developer account (€99/yr)
- **Revolut Merchant API** webhook — currently class bookings use plain revolut.me redirects; webhook would auto-mark bookings paid
- **Public analytics dashboard** on `/about` — anonymised fed-wide stats
- **Dark/light theme toggle** — currently dark-only

---

## Not active / parked

- **€10 fighter application fee** — fully removed per the organiser's direction. All payment code deleted (migration 007 in the legacy app documented this).
- **Instagram feed on homepage** — placeholder; organiser hasn't supplied an official account yet.
- **News/Gallery sections** — feature-flagged off in the legacy prototype; not ported to the new app.
- **Championships filter** on `/events` — route exists in nav dropdown but shows the standard events page for now.

---

## Test logins (local dev)

| Role | Email | Password | Lands on |
|---|---|---|---|
| **Platform admin** | `admin@wuco.ie` | `WucoAdmin2026!` | `/portal` — full dashboard |
| **Ranking admin** | `rankings@wuco.ie` | `WucoRankings2026!` | `/portal/ranking` — scoped |
| **Fighter** (demo) | `fighter@wuco.ie` | `WucoDemo2026!` | `/portal` — fighter card |
| **Promoter** | `promoter@wuco.ie` | `WucoDemo2026!` | `/portal` — basic |

Seed data: 12 approved fighters · 2 pending · 1 rejected · 1 affiliated club (Monarch Fight Academy with 11 classes + 4 pricing products) · 1 live event with 4 unsettled bouts · 3 upcoming events · 2 past events · 2 gym enquiries · 5 class bookings · 10 ranking positions.

---

## Deploy

See `render.yaml` at the repo root. Required dashboard env vars: `AUTH_URL`, `NEXT_PUBLIC_SITE_URL`, (optional) `WUCO_ADMIN_INBOX`. `AUTH_SECRET` is auto-generated on first deploy. SQLite lives on a 1 GB persistent disk at `/opt/render/project/src/app-next/prisma/dev.db` and survives redeploys.

Local dev:

```bash
cd app-next
npm ci
npx prisma migrate deploy
npx tsx prisma/seed.ts    # optional — only if you want sample data
npm run dev
```

---

## Repository layout

```
rfc-website/
├── app-next/              # Production Next.js app (THIS is the one)
│   ├── app/               # Routes (public + portal + admin + ranking + api)
│   ├── components/        # UI primitives, site shell, forms, user menu
│   ├── lib/               # Prisma client, auth, mail, cn, password
│   ├── prisma/            # Schema + migrations + seed
│   └── public/brand/      # WUCO logo (transparent), arena hero
├── docs/
│   ├── STATUS.md          # ← you are here
│   ├── EMAIL.md           # mail abstraction + category reference
│   └── FUTURE_PLANS.md    # Apple Wallet / Google Wallet / Resend / Postgres
├── render.yaml            # One-click deploy for Render Blueprints
└── [legacy Python prototype at root — kept for reference]
```
