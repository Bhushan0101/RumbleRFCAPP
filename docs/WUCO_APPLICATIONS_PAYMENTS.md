# W.U.C.O: applications, payments, approvals and event registration

The current brand is **W.U.C.O**. No expansion of that name or legal company details has been invented.
Schema migration 006 adds applications, payment/receipt records, finance audit and event-entry status.
Existing profiles remain approved legacy records; the migration does not invent historical fee payments.

## Current deployment: stakeholder test payments

The Render blueprint explicitly selects `WUCO_DEMO_MODE=1` and `WUCO_PAYMENT_MODE=demo`.
Existing services with `RFC_DEMO_MODE=1` continue to work through the compatibility alias. Demo checkout
says **TEST CHECKOUT — NO REAL CHARGE**, collects no card details and issues a watermarked PDF receipt.
Test payments never count as live receipts in finance reports. Default startup without demo mode or a
configured provider does not silently mark payments as successful.

The previous five demo email addresses migrate to `<role>@demo.wuco.test`, where role is admin,
fighter, gym, coach or promoter. Fresh and unchanged-default demo passwords become **`WucoDemo2026!`**.
Only the old public default password is upgraded; any user-customized password is preserved. Old
`<role>@demo.rfc.test` login addresses remain aliases. Real account emails/passwords are unchanged.
The repository name, archived logo asset and legacy `RFC_*` bindings remain for compatibility; they
are not the displayed brand. Existing Render services need not be recreated or renamed.

## End-to-end stakeholder walkthrough

1. Open **Member portal → Join W.U.C.O**. Complete Account, Fighter profile/photo, and Review.
   Select Featherweight or Lightweight and optionally connect a gym with its invitation code.
2. Select **Create application**. The account is signed in and the private application is saved.
   The fighter is **not** on the public roster/rankings and cannot enter events yet.
3. In **Your fighter application**, select **Open test checkout · €10**. Confirm the test-only notice,
   then **Record test payment · €10**. No card data is collected and no money moves.
4. The application changes to **Awaiting admin approval**. Download the test PDF receipt. Repeat
   payment confirmation must not add another payment/receipt or another EUR 10 to the report.
5. In a separate browser/session, sign in as `admin@demo.wuco.test` / `WucoDemo2026!`. Open **Fighters**.
   **Ready for review** contains the paid application; unpaid applications are separately under **Fee due**.
6. Review the profile and receipt, choose **Approve fighter**, then **Save review decision**.
   Approval without a completed payment is blocked by the server. Decline/suspension requires a note;
   the note is visible to the applicant. Administrators can edit fighter metadata separately.
7. As the fighter, select **Refresh status**. The page becomes **Your fighter profile** and event entry
   is unlocked. The approved profile is now public; rankings still require an administrator to publish
   a position. Profile edits/photo changes do not fabricate W/L/D records.
8. Open an upcoming event that accepts the category and has an open slot before its deadline. Confirm
   your fighter details and authorization, then select **Confirm event registration**.
9. Expect **You’re registered**, a unique `WUCO-E…` confirmation reference and a single increment in the
   participant count. Refreshing does not duplicate entry. Concurrent requests cannot exceed capacity.
10. Before assignment to a bout, **Withdraw entry** frees the slot. Re-entering uses the same reference.
    Once assigned to a bout, contact the promoter; the portal blocks an unsafe withdrawal. Promoters
    publish cards only from confirmed, approved entrants in the same category, then record results.
11. As admin, open **Finance**. Live gross/refunds/net are separate from TEST totals. Filter by date,
    inspect payment statuses/payers/receipts, download a PDF receipt or export CSV. Net receipts are
    before provider fees and tax adjustments; this is not a profit or tax-return report.

The EUR 10 fee is the **fighter application fee**, not an event ticket or a second event entry fee.
No additional event fee is collected. Payment is not a guarantee of approval. No refund policy has
been invented: an administrator declining an application does not automatically refund it.

## Guest competitors

A promoter may submit a guest application from an event. It creates a private competitor profile,
not a login or event entry. The submitting promoter can pay the application fee on the guest's behalf;
admin approval is still required. Once approved, select that guest from the eligible entry list.
Existing seeded guest competitors are preserved as approved legacy sample profiles.

## Real Stripe payments: separate configuration and hosted verification required

No Stripe account/credentials were available during implementation. The provider adapter is covered
by mocked integration tests and signed-webhook tests; a live Stripe checkout was **not** exercised.
Configure in Render's secure environment settings, never in source/chat:

| Variable | Purpose |
| --- | --- |
| `WUCO_PAYMENT_MODE=stripe` | Use hosted Stripe Checkout, not the test simulator |
| `STRIPE_SECRET_KEY` | Stripe secret key; begin with a Stripe test key |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for this service's webhook endpoint |
| `WUCO_PUBLIC_URL` | Actual HTTPS website origin, without query/fragment |
| `WUCO_DB_PATH` | Database on retained storage (legacy `RFC_DB_PATH` also supported) |
| `WUCO_FINANCE_DURABLE=1` | Explicitly declare that durable finance storage is configured |

For actual live keys, checkout is blocked unless durable finance storage is declared and the actual
SQLite file is outside temporary directories. Render free-tier `/tmp` storage is not suitable for
live payments or financial records. Use a persistent disk on a suitable service and tested backups;
use a separate clean database for live operations. Uploaded photos also need retained storage.

Set Stripe webhook destination to `/api/payments/stripe/webhook` on the actual HTTPS site. Subscribe
to `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `checkout.session.expired` and `charge.refunded`.
The application verifies the raw-body signature and timestamp, deduplicates provider event IDs,
and checks amount, EUR currency, session, metadata and test/live mode before recording payment.
A browser success URL or a client-supplied `paid` flag cannot establish payment. The return route can
retrieve the session directly from Stripe to reconcile status. Refunds are retained even when their
webhook arrives before checkout completion. Full refunds suspend the paid membership for review.
Actual duplicate provider charges are retained and flagged for review rather than erased from finance.

Test the hosted Stripe test-mode flow and webhook delivery on Render before considering live keys.
This requires outbound HTTPS access to `api.stripe.com` from the runtime. No live money was charged,
no Stripe credentials were saved, and no successful real provider operation is claimed by this work.

## Receipts and record retention

Payment rows store integer EUR cents, immutable paid-at/receipt references and payer/fighter snapshots.
Approval, payment and event entry actions have audit tables. Receipts are downloadable PDF payment
acknowledgments, **not VAT invoices**; no tax registration, legal address or VAT rate was invented.
Refunds are recorded from verified provider events. There is no manual "mark live payment paid" route.
Report dates use confirmed payment dates (UTC), falling back to checkout creation dates for unfinished attempts.
CSV fields are escaped against spreadsheet formulas. Only payer/application owner/admin can access
receipts; the finance ledger, CSV and review queue require app-admin access.

Render demo data/receipts can reset after restart/redeploy because free-tier storage is ephemeral.
For real financial retention, configure durable storage and backups before enabling live payments.

## Tests

Install `requirements.txt` (now includes ReportLab for PDF receipts), then:

```sh
python -m unittest discover -s tests -v
python scripts/check_project.py
```

`tests/test_applications_finance.py` covers paid approval, private pending profiles, fixed EUR 10,
receipt ownership/idempotency, cancellation/retry, separate test/live totals, CSV/date filters,
provider-side verification, signed/replayed/out-of-order webhooks, refunds, temporary-storage live
blocking, guest review, entry category/deadline/capacity, confirmation/withdrawal and concurrent entries.
The optional `tests/browser/fighter_journey.py` covers the full demo payment/approval/event/receipt/CSV
journey against Gunicorn, with responsive checks at 360/390/768/1440/1920px. Default test port is 8006;
`WUCO_TEST_URL` overrides it. Browser tooling is not an application dependency.
