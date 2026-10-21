import { state } from "./state.js";
import {
  esc,
  field,
  categorySelect,
  select,
  avatar,
  table,
  badge,
} from "./shared.js";
import { money, statusLabel } from "./payments.js";
let filter = "pending_approval";
let financeData = null;
export let financeFilters = { from: "", to: "" };
export function setApplicationFilter(value) {
  filter = value;
}
export function setFinance(data, filters = financeFilters) {
  financeData = data;
  financeFilters = filters;
}
export function applicationsPage() {
  const list = (state.applications || []).filter(
    (a) => filter === "all" || a.approval_status === filter,
  );
  return `<div class="page-heading"><div><span class="overline">ADMINISTRATOR WORKSPACE</span><h1>Fighter management.</h1><p class="intro">Review paid applications and manage approved profiles. The payment check is enforced by the server.</p></div><a class="button secondary" href="#finance">Finance & receipts →</a></div><nav class="application-tabs" aria-label="Application status">${[
    ["pending_approval", "Ready for review"],
    ["awaiting_payment", "Fee due"],
    ["approved", "Approved"],
    ["rejected", "Declined"],
    ["suspended", "Suspended"],
    ["all", "All"],
  ]
    .map(
      ([value, label]) =>
        `<button class="button ${filter === value ? "primary" : "secondary"}" data-action="application-filter" data-value="${value}">${label} <span>${(state.applications || []).filter((a) => value === "all" || a.approval_status === value).length}</span></button>`,
    )
    .join("")}</nav><div class="application-grid">${
    list
      .map(
        (a) =>
          `<section class="panel"><div class="profile-identity">${avatar({ name: a.name, portrait_url: a.portrait_url }, "avatar-large")}<div><h2>${esc(a.name)}</h2><p class="muted">${esc(a.email || "Guest application")} · ${esc(a.division)}</p>${badge(statusLabel(a.approval_status))}</div></div><div class="payment-check">${a.legacy_member ? "Existing member · no new fee required" : a.receipt_number ? `${a.payment_is_test ? "TEST payment" : "Payment"} received · €10 <a href="/api/portal/payments/${a.payment_id}/receipt" download>Receipt ↓</a>` : "Application fee not paid · approval blocked"}</div>${a.review_note ? `<p class="muted">Admin note: ${esc(a.review_note)}</p>` : ""}${
            a.approval_status !== "awaiting_payment"
              ? `<form data-form="fighter-review" data-athlete="${a.athlete_id}">${select(
                  "Decision",
                  "decision",
                  (a.approval_status === "approved"
                    ? [["suspended", "Suspend profile"]]
                    : [
                        ["approved", "Approve fighter"],
                        ["rejected", "Decline application"],
                      ]
                  ).map(([id, name]) => ({ id, name })),
                  "",
                  true,
                )}<label>Review note<textarea name="note" maxlength="2000" placeholder="Required for a decline or suspension; visible to the applicant."></textarea></label><button class="button primary">Save review decision</button></form>`
              : ""
          }<details><summary>Edit fighter profile</summary><form data-form="admin-fighter-profile" data-athlete="${a.athlete_id}"><div class="two">${field("Full name", "name", a.name)}${categorySelect(a.division)}${field("Country", "country", a.country)}</div><button class="button secondary">Save fighter details</button></form></details></section>`,
      )
      .join("") ||
    '<section class="panel empty-state"><h2>No applications in this view.</h2><p>Paid applications appear under Ready for review.</p></section>'
  }</div>`;
}
export function financePage() {
  const data = financeData;
  if (!data)
    return '<section class="panel"><h1>Finance & receipts.</h1><p>Loading payment records…</p></section>';
  return `<div class="page-heading"><div><span class="overline">ADMINISTRATOR · FINANCE</span><h1>Payments & receipts.</h1><p class="intro">Live receipts and simulated test payments are reported separately. Amounts are in EUR.</p></div><button class="button secondary" data-action="finance-export">Download CSV ↓</button></div><form data-form="finance-report" class="finance-filters"><div class="two">${field("From date", "from", financeFilters.from, "date", false)}${field("To date", "to", financeFilters.to, "date", false)}</div><button class="button secondary">Apply date filter</button></form><div class="finance-metrics"><section class="panel"><span class="overline">LIVE GROSS RECEIPTS</span><strong>${money(data.live.gross_cents)}</strong><p class="muted">${data.live.paid_count} confirmed live payments</p></section><section class="panel"><span class="overline">LIVE REFUNDS</span><strong>${money(data.live.refund_cents)}</strong><p class="muted">Provider-reported refunds</p></section><section class="panel"><span class="overline">LIVE NET RECEIPTS</span><strong>${money(data.live.net_cents)}</strong><p class="muted">Before provider fees and tax adjustments</p></section><section class="panel test-metric"><span class="overline">TEST PAYMENTS ONLY</span><strong>${money(data.test.gross_cents)}</strong><p class="muted">${data.test.paid_count} simulated / provider test payments · not real revenue</p></section></div><section class="panel"><h2>Payment ledger</h2>${table(["Receipt / date", "Fighter / payer", "Amount", "Status", "Mode", "Download"], data.payments.map((p) => `<tr><td>${esc(p.receipt_number || "Checkout #" + p.id)}<small class="cell-note">${esc(p.paid_at || p.created_at)}</small></td><td>${esc(p.fighter_name)}<small class="cell-note">${esc(p.payer_name)} · ${esc(p.payer_email)}</small></td><td>${money(p.amount_cents)}${p.refunded_cents ? '<small class="cell-note">Refunded ' + money(p.refunded_cents) + "</small>" : ""}</td><td>${esc(p.status)}${p.duplicate_application_payment ? '<small class="cell-note">Duplicate fee: review/refund required</small>' : ""}</td><td>${badge(p.is_test ? "TEST" : "LIVE")}</td><td>${p.status === "paid" ? `<a href="/api/portal/payments/${p.id}/receipt" download>PDF ↓</a>` : "—"}</td></tr>`).join(""))}</section>`;
}
