# Future plans

Items that are intentionally **not** in the first release. Each is parked with a short note so
when the organiser is ready to pay for / provide the missing piece, the implementation path is
clear.

## Apple Wallet Fighter Passport (`.pkpass`)

A `.pkpass` is Apple's signed pass bundle: a zipped directory of JSON + images, signed with a
certificate issued by Apple to a specific Pass Type ID. iOS devices then show the pass in the
Wallet app, with push updates for record/status changes.

**Why parked:** signing requires:

1. Apple Developer Program membership — €99/year.
2. A Pass Type ID in developer.apple.com (one per pass style).
3. A signing certificate (`.p12`) + private key for that Pass Type ID.
4. The Apple WWDR intermediate certificate.

**When unlocked, implementation sketch:**

- Add signing bundle under `secrets/wallet/` (gitignored).
- New endpoint `GET /api/passport/<fighter_no>.pkpass` builds the pass JSON from the fighter's
  current approved record, zips with the three cert files, signs the manifest, returns
  `application/vnd.apple.pkpass`.
- Add an "Add to Apple Wallet" button to the public passport page (only when the signing bundle
  is present at runtime).
- For live records (status transitions), add an APNs push webhook and `authenticationToken` so
  the pass auto-updates on the device.

Until then, the digital passport is a public web page + QR code (no wallet integration).

## Google Wallet pass

Equivalent to Apple Wallet, uses a Google service account instead of a signing cert. Can be
added in parallel once the Apple route lands.

## Real SMTP delivery

See `docs/EMAIL.md`. Replace the `wuco_mail.send()` body with `smtplib` or a provider SDK. All
message content and the DB audit table are already in place.

## Revolut Merchant API (webhook-confirmed bookings)

First release uses a plain redirect to `revolut.me/<gym-handle>/<amount>`. A booking record is
created at redirect time with status `pending_payment`. There is no webhook confirmation, so the
gym admin flips bookings to `paid` manually.

**When upgraded:** use Revolut Merchant API with a webhook on payment success; auto-transition
`pending_payment → paid` and credit the booking.

## Fighter record ingest from Excel

Rankings template exists under `docs/templates/`. Extend to a fighter-record ingest so
promoters can submit fight results in bulk after each event.

## Stripe / card payments

Fully removed in the first release (migration 007). If reinstated, re-add as an *optional*
provider alongside Revolut, with the same DB audit shape.
