# WUCO Ireland — Website Status (Beta, Local)

**Version:** Beta — Limited Release
**Last reviewed:** 2026-11-09
**Deploy target (local):** Next.js 16 dev server + SQLite + ZeptoMail (HTTP API)
**Production target:** Cloudflare Workers + D1 + ZeptoMail (same mail API)

This document is the single source of truth for what works, what's wired but needs configuration, and what is deliberately parked. Pair with `TESTING_PLAN.md` for the manual test matrix.

---

## 1. Features that WORK out of the box (local)

| Feature | State | Notes |
|---|---|---|
| Public homepage (hero, action cards, rankings panel, quick services) | ✅ Live | Rankings tile has live filters (type · discipline · weight). Weight list is dependency-driven on top filters. |
| National rankings page `/rankings` | ✅ Live | Reads `rankings` table, groups by division. |
| Fighter directory `/fighters` + detail `/fighters/[id]` | ✅ Live | Shows record, discipline, division, club. |
| Public fighter passport `/passport/[fighterNo]` | ✅ Live | QR code, status, verification view. |
| Clubs listing + club detail `/clubs`, `/clubs/[slug]` | ✅ Live | Timetable image + structured classes + products. |
| Join as a Club `/clubs/join` | ✅ Live | Enquiry form → **admin@wucoireland.ie** via ZeptoMail. |
| Events listing `/events` + detail `/events/[id]` | ✅ Live | Admin-managed cards & bouts. |
| Become a Promoter `/promoters/join` | ✅ Live | Form present; backend routes enquiry same as Clubs. |
| News `/news` + `/news/[slug]` | ✅ Live | Admin-managed posts, publish/draft toggle. |
| Fighter registration `/register` | ✅ Live | 3-step wizard with: DoB (Day/Month/Year dropdowns), country typeahead (full ISO list), gender/martial-art/division dependencies, class tier. Enter-key submit guard. |
| Member sign-in `/portal/sign-in` | ✅ Live | NextAuth credentials; password hashed with salt. |
| Fighter dashboard `/portal` | ✅ Live | Shows card, status, completeness bar, notifications tile. |
| Fighter profile editor `/portal/profile` | ✅ Live | Edit name/nickname/country/bio. |
| Profile photo upload | ✅ Live (local) | Accepts JPG/PNG/WEBP/GIF ≤ 8 MB, saved to `/public/uploads/fighters/`. ⚠ Local filesystem — Workers needs R2 swap for prod. |
| Injuries form (yes/no + details) | ✅ Live | Persisted on `fighter_profiles`. |
| Fight history CRUD (add / remove) | ✅ Live | Each entry recomputes the Athlete W-L-D automatically. |
| Profile completeness scoring | ✅ Live | 50% baseline on approval; +15 photo, +15 injury, +20 first fight history entry → 100%. |
| Admin dashboard `/portal` (as admin) | ✅ Live | KPIs, recent audit, recent bookings. |
| Admin fighters review `/portal/admin/fighters` | ✅ Live | Approve / Reject / Suspend with note; emits passport number. |
| Division-peer notifications | ✅ Live | On approval, every existing approved fighter in same **gender + division + martial art** gets a `Notification` row. |
| Notifications `/portal/notifications` + bell in header | ✅ Live | Unread badge count; mark-all-read action. |
| Admin inbox `/portal/admin/inbox` | ✅ Live | Reads `outbound_mail` table — every outbound email is mirrored here. |
| Admin news CRUD `/portal/admin/news` | ✅ Live | Create/edit/delete, draft vs publish. |
| Gym onboarding tokens | ✅ Live | Signed link, 14-day expiry. |
| Support request (priority: Low / Normal / High / Urgent) | ✅ Live | Sends to **admin@wucoireland.ie** via ZeptoMail, priority tagged in subject + colour-coded HTML banner. |
| Correction request | ✅ Live | Sends to **info@wucoireland.ie** via ZeptoMail. |
| Beta ribbon on every page | ✅ Live | Always-on "BETA · Limited release" banner above the header. |

---

## 2. Features that are WIRED but need configuration / data

| Feature | What's wired | What's needed |
|---|---|---|
| Real email delivery (ZeptoMail) | `lib/mail.ts` sends via ZeptoMail HTTP API when `WUCO_ZEPTOMAIL_API_KEY` is set. | API key is set locally (`.env`). For production, set it as a Cloudflare Workers secret and verify EU endpoint. |
| MX + DKIM + SPF + DMARC DNS | ✅ configured on Cloudflare DNS for `wucoireland.ie`. | Delivery working; no action. |
| Rankings on homepage tile | Live table, filter-driven. | Needs more fighters approved + ranking rows inserted to light up Women / Juniors / MMA / BJJ combinations. Only a handful seeded today. |
| Admin password | `scripts/set_admin_password.py` in the old Python repo; Next.js uses seeded `admin@wuco.ie / WucoAdmin2026!` from `prisma/seed.ts`. | **Change before production.** Reset by seeding a new admin or updating the `portal_users` row directly. |

---

## 3. Features that are PARKED / NOT configured

| Feature | State | Reason |
|---|---|---|
| **Class bookings payment** | Stub only | Revolut handle shown on class page; actual payment flow is not integrated. CLAUDE.md says "no paid provider without concrete need." |
| **Apple Wallet .pkpass** | Parked | Docs/FUTURE_PLANS.md — requires Apple developer certificate. |
| **Instagram feed** | Parked | docs/INSTAGRAM.md — API gate not opened. |
| **Stories / Gallery** | Hidden (feature flag) | `site_settings.gallery_enabled=0`, `news_enabled=0` by default. News is now **re-enabled** via admin UI. Gallery/Stories still off. |
| **Automatic class re-tier based on fight count** | Not implemented | Admin still sets class manually. Fight history recomputes W-L-D but does not escalate J→N→C etc. |
| **Push notifications (web push)** | Not implemented | Notifications are DB-backed only. |
| **Public search bar** (icon in header) | UI only | Button renders but there is no search endpoint. |
| **Multi-language (Irish)** | Not implemented | Site is English only. |
| **Promoters directory `/promoters`** | Route exists, content stub | Needs real promoter data to populate. |

---

## 4. Environment configuration (local `.env`)

```
DATABASE_URL=file:./prisma/dev.db
AUTH_SECRET=<replace before production>
AUTH_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Mail routing
WUCO_MAIL_ADMIN=admin@wucoireland.ie
WUCO_MAIL_INFO=info@wucoireland.ie

# ZeptoMail (HTTP API — works on Node and Cloudflare Workers)
WUCO_EMAIL_PROVIDER=zeptomail
WUCO_EMAIL_API_URL=https://cpaas.zoho.eu/v1.1/email
WUCO_EMAIL_FROM=info@wucoireland.ie
WUCO_EMAIL_FROM_NAME=WUCO Ireland
WUCO_ZEPTOMAIL_API_KEY=Zoho-enczapikey <token>
```

For production on Cloudflare:
- Set all of the above as Worker secrets via `wrangler secret put`.
- `DATABASE_URL` is replaced by a D1 binding — see `wrangler.jsonc`.
- `/public/uploads/fighters/` filesystem writes must be swapped to R2 before deploy.

---

## 5. Email routing matrix

| Trigger | To | From | Priority |
|---|---|---|---|
| Fighter signup (user-facing confirmation) | registrant | info@wucoireland.ie | — |
| Fighter signup (admin notification) | admin@wucoireland.ie | info@wucoireland.ie | — |
| Fighter approved | registrant | info@wucoireland.ie | — |
| Fighter rejected / suspended | registrant | info@wucoireland.ie | — |
| Gym enquiry (Join as Club) | admin@wucoireland.ie | info@wucoireland.ie | — |
| Gym onboarding link (admin invites) | gym contact | info@wucoireland.ie | — |
| Gym onboarding submitted | admin@wucoireland.ie | info@wucoireland.ie | — |
| Gym approved | gym contact | info@wucoireland.ie | — |
| Profile correction request | info@wucoireland.ie | info@wucoireland.ie | — |
| Support request | **admin@wucoireland.ie** | info@wucoireland.ie | **tagged in subject + HTML banner** |

Every email is also mirrored to the DB `outbound_mail` table (visible at `/portal/admin/inbox`) regardless of delivery success.

---

## 6. Go-live estimate

Assumptions:
- Content is final before launch (fighters, clubs, ranking data loaded).
- Admin reviews fighter signups within 1–2 business days.
- Cloudflare account + domain + ZeptoMail already configured (they are).
- No new features added before go-live beyond what's listed here.

| Phase | Work | Time |
|---|---|---|
| **1. Cloudflare port** | Swap SQLite → D1, filesystem uploads → R2, verify ZeptoMail works from Worker, update env secrets, deploy to a `*.workers.dev` preview URL. | 4–6 hours |
| **2. Preview testing (stakeholder)** | Walk through the TESTING_PLAN on the preview URL. Fix anything broken in production that worked locally. | 2–3 hours |
| **3. DNS cutover** | Point `wucoireland.ie` A/CNAME at Cloudflare, set custom domain on the Worker, verify TLS. | 1 hour |
| **4. Admin password + content load** | Reset admin password, seed real gyms + events + initial rankings, publish first news post. | 1–2 hours |
| **5. Full regression** | Re-run the TESTING_PLAN against the live domain end to end, including email deliverability from every form. | 2 hours |
| **6. Soft launch** | Share URL with 5–10 fighters for real signups; monitor emails and admin inbox for 48h. | 2 days |
| **7. Public launch** | Announce on socials once soft launch is clean. | — |

**Total active work:** ~10–14 hours of engineering + 2 days observation.
**Earliest realistic go-live:** 3–5 business days from today assuming no new scope lands.

### Deliberate gaps at launch (acceptable for Beta)

- Class booking payments (users see Revolut handle, pay manually).
- Apple Wallet pass (digital passport web page covers it).
- Push notifications (email is the channel, DB-backed notifications visible on login).
- Gallery / stories pages.
