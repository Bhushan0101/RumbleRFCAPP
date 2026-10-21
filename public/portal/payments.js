import { state } from "./state.js";
import { esc, icon, table, badge } from "./shared.js";
export const money = (cents) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
export const statusLabel = (status) =>
  ({
    awaiting_payment: "Application fee due",
    pending_approval: "Awaiting admin approval",
    approved: "Approved fighter",
    rejected: "Application declined",
    suspended: "Profile suspended",
  })[status] || status;
export function applicationCard(app) {
  if (!app) return "";
  const paid = state.my_payments?.find(
    (p) =>
      p.athlete_id === app.athlete_id &&
      p.status === "paid" &&
      p.refunded_cents < p.amount_cents,
  );
  const canPay = app.approval_status === "awaiting_payment";
  return `<section class="panel application-status ${app.approval_status}"><div class="panel-heading"><div><span class="overline">W.U.C.O FIGHTER APPLICATION</span><h2>${esc(statusLabel(app.approval_status))}</h2></div>${badge(app.approval_status === "approved" ? "APPROVED" : "APPLICATION")}</div><ol class="application-steps"><li class="done">1. Profile created</li><li class="${paid || app.legacy_member ? "done" : ""}">2. ${app.legacy_member ? "Existing member" : "€10 application fee"}</li><li class="${app.approval_status === "approved" ? "done" : ""}">3. Admin approval</li></ol><p class="muted">${canPay ? "Your profile is saved privately. Pay the €10 application fee to send it to the administrator for review." : app.approval_status === "pending_approval" ? "Payment received. An administrator must approve your application before you appear on the roster or enter events." : app.approval_status === "approved" ? "Your profile is approved. You can now register for eligible events." : esc(app.review_note || "Contact the administrator about your application.")}</p><div class="portal-actions">${canPay ? `<button class="button primary" data-action="start-checkout" data-athlete="${app.athlete_id}">${state.payment_settings.mode === "demo" ? "Open test checkout" : "Pay application fee"} · €10 ${icon("arrow")}</button>` : ""}${paid ? `<a class="button secondary" href="/api/portal/payments/${paid.id}/receipt" download>Download ${paid.is_test ? "test " : ""}receipt ↓</a>` : ""}<button class="button ghost" data-action="refresh-status">Refresh status</button></div>${state.payment_settings.mode === "demo" && canPay ? '<p class="field-hint">Stakeholder test checkout. No card details and no real charge.</p>' : ""}${!state.payment_settings.ready && canPay ? '<p class="field-hint">Payments are not configured yet. Your application is retained; contact the administrator.</p>' : ""}</section>`;
}
export function checkoutPage(id) {
  const payment = state.my_payments?.find((p) => p.id === id);
  if (!payment)
    return '<section class="panel empty-state"><h1>Checkout not found.</h1><a href="#payments">Back to my payments</a></section>';
  if (payment.status === "paid")
    return `<section class="panel narrow-page"><span class="overline">PAYMENT RECORDED</span><h1>Ready for review.</h1><p class="intro">Your ${payment.is_test ? "test " : ""}payment has been recorded. Administrator approval is the next step.</p><a class="button primary" href="#${state.user.role === "fighter" ? "fighter" : "payments"}">Continue ${icon("arrow")}</a><a class="button secondary" href="/api/portal/payments/${id}/receipt" download>Download receipt ↓</a></section>`;
  if (payment.provider !== "demo")
    return `<section class="panel narrow-page"><h1>Secure application checkout.</h1><p class="intro">Continue to the payment provider to complete your €10 application fee.</p><button class="button primary" data-action="start-checkout" data-athlete="${payment.athlete_id}">Continue to checkout →</button></section>`;
  return `<div class="narrow-page"><a class="back-link" href="#payments">← My applications & payments</a><section class="panel checkout-card"><span class="badge accent">TEST CHECKOUT · NO REAL CHARGE</span><h1>One step closer.</h1><p class="intro">This is a simulated stakeholder payment. Do not enter card or bank details.</p><dl class="review-list"><div><dt>Fighter</dt><dd>${esc(payment.fighter_name)}</dd></div><div><dt>Application fee</dt><dd>${money(payment.amount_cents)}</dd></div><div><dt>Currency</dt><dd>EUR</dd></div><div><dt>Next step</dt><dd>Administrator review</dd></div></dl><label class="check-line"><input id="demo-payment-consent" type="checkbox">I understand this is a test payment and no money will be charged.</label><button class="button primary full-width" data-action="demo-pay" data-payment="${id}">Record test payment · €10 ${icon("check")}</button><button class="button ghost full-width" data-action="cancel-checkout" data-payment="${id}">Cancel test checkout</button><p class="field-hint">Payment does not guarantee approval. The €10 fee is for the fighter application, not an event ticket or event entry fee.</p></section></div>`;
}
export function paymentsPage() {
  return `<div class="page-heading"><div><span class="overline">YOUR PAYMENT RECORDS</span><h1>Applications & receipts.</h1><p class="intro">Track your application fee, approval and downloadable receipts.</p></div><a class="button secondary" href="#account">My workspace →</a></div>${(state.my_applications || []).map((a) => `<div class="payment-application"><h3>${esc(a.name)}</h3>${applicationCard(a)}</div>`).join("")}<section class="panel"><h2>Payment history</h2>${table(["Date", "Fighter", "Amount", "Status", "Receipt"], (state.my_payments || []).map((p) => `<tr><td>${esc(p.paid_at || "Not completed")}</td><td>${esc(p.fighter_name)} ${p.is_test ? badge("TEST") : ""}</td><td>${money(p.amount_cents)}</td><td>${esc(p.status)}${p.refunded_cents ? " · Refunded " + money(p.refunded_cents) : ""}</td><td>${p.status === "paid" ? `<a href="/api/portal/payments/${p.id}/receipt" download>Download PDF ↓</a>` : "—"}</td></tr>`).join(""))}</section>`;
}
