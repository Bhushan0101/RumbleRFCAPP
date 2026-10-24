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

const STATUS_LABEL = {
  pending_approval: "Pending approval",
  approved: "Approved",
  rejected: "Declined",
  suspended: "Suspended",
};

const CLASS_LABEL = {
  J: "J-Class (U18)",
  N: "N-Class (≤5 fights)",
  L: "L-Class (Learning)",
  C: "C-Class (No shin pads)",
  B: "B-Class (Debut pro)",
  A: "A-Class (Seasoned pro)",
};

const CLASS_OPTIONS = [
  { id: "", name: "No class set" },
  { id: "J", name: "J-Class (U18)" },
  { id: "N", name: "N-Class (≤5 fights)" },
  { id: "L", name: "L-Class (Learning)" },
  { id: "C", name: "C-Class (No shin pads)" },
  { id: "B", name: "B-Class (Debut pro)" },
  { id: "A", name: "A-Class (Seasoned pro)" },
];

let filter = "pending_approval";
export function setApplicationFilter(value) {
  filter = value;
}
export function applicationsPage() {
  const list = (state.applications || []).filter(
    (a) => filter === "all" || a.approval_status === filter,
  );
  return `<div class="page-heading"><div><span class="overline">ADMINISTRATOR WORKSPACE</span><h1>Fighter management.</h1><p class="intro">Review applications and manage approved profiles.</p></div></div><nav class="application-tabs" aria-label="Application status">${[
    ["pending_approval", "Pending approval"],
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
          `<section class="panel"><div class="profile-identity">${avatar({ name: a.name, portrait_url: a.portrait_url }, "avatar-large")}<div><h2>${esc(a.name)}</h2><p class="muted">${esc(a.email || "Guest application")} · ${esc(a.martial_art || "Martial art not set")} · ${esc(CLASS_LABEL[a.class_code] || "No class")}</p>${badge(STATUS_LABEL[a.approval_status] || a.approval_status)}</div></div>${a.review_note ? `<p class="muted">Admin note: ${esc(a.review_note)}</p>` : ""}<form data-form="fighter-review" data-athlete="${a.athlete_id}">${select(
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
          )}<label>Review note<textarea name="note" maxlength="2000" placeholder="Required for a decline or suspension; visible to the applicant."></textarea></label><button class="button primary">Save review decision</button></form><details><summary>Edit fighter profile</summary><form data-form="admin-fighter-profile" data-athlete="${a.athlete_id}"><div class="two">${field("Full name", "name", a.name)}${field("Martial art", "martial_art", a.martial_art || "", "text", false)}${select("Class", "class_code", CLASS_OPTIONS, a.class_code || "", false)}${categorySelect(a.division)}${field("Country", "country", a.country)}</div><button class="button secondary">Save fighter details</button></form></details></section>`,
      )
      .join("") ||
    '<section class="panel empty-state"><h2>No applications in this view.</h2><p>New registrations appear under Pending approval.</p></section>'
  }</div>`;
}

const ENQUIRY_LABEL = {
  new: "New enquiry",
  invited: "Onboarding link sent",
  onboarding: "Form in progress",
  submitted: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
};

export function gymEnquiriesPage() {
  const list = state.gym_enquiries || [];
  return `<div class="page-heading"><div><span class="overline">ADMINISTRATOR WORKSPACE</span><h1>Gym enquiries.</h1><p class="intro">Review new gym enquiries, send the onboarding link, and approve submissions to create a coach account.</p></div><a class="button secondary" href="/gyms/join.html" target="_blank">Public enquiry page ↗</a></div><div class="application-grid">${
    list.map((e) =>
      `<section class="panel"><div><h2>${esc(e.gym_name)}</h2><p class="muted">${esc(e.contact_name)} · <a href="mailto:${esc(e.contact_email)}">${esc(e.contact_email)}</a>${e.phone ? " · " + esc(e.phone) : ""}${e.city ? " · " + esc(e.city) : ""}</p>${badge(ENQUIRY_LABEL[e.status] || e.status)}</div>${e.message ? `<p class="muted">“${esc(e.message)}”</p>` : ""}${e.review_note ? `<p class="muted">Admin note: ${esc(e.review_note)}</p>` : ""}<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">${
        e.status === "new"
          ? `<button class="button primary" data-action="gym-invite" data-enquiry="${e.id}">Send onboarding link</button><button class="button ghost" data-action="gym-reject" data-enquiry="${e.id}">Reject</button>`
          : e.status === "invited" || e.status === "onboarding"
            ? `<button class="button secondary" data-action="gym-invite" data-enquiry="${e.id}">Resend link</button><span class="muted">Awaiting submission</span>`
            : e.status === "submitted"
              ? `<button class="button primary" data-action="gym-approve" data-enquiry="${e.id}">Approve &amp; create coach account</button><button class="button ghost" data-action="gym-reject" data-enquiry="${e.id}">Reject</button>`
              : `<span class="muted">${esc(ENQUIRY_LABEL[e.status] || e.status)}</span>`
      }</div></section>`,
    ).join("") || '<section class="panel empty-state"><h2>No gym enquiries yet.</h2><p>Share the public gym enquiry page with prospective clubs to collect leads.</p></section>'
  }</div>`;
}

export function notificationsPage() {
  const list = state.notifications || [];
  const CATEGORY_LABEL = {
    fighter_signup: "Fighter signup",
    fighter_approved: "Fighter approved",
    fighter_rejected: "Fighter declined",
    gym_enquiry: "Gym enquiry",
    gym_onboarding: "Onboarding link sent",
    gym_submitted: "Gym onboarding submitted",
    gym_approved: "Gym approved",
    gym_join_request: "Gym join request",
    class_booking: "Class booking",
  };
  return `<div class="page-heading"><div><span class="overline">ADMINISTRATOR WORKSPACE</span><h1>Notifications.</h1><p class="intro">Outbound mail is logged here (and to <code>logs/outbound_mail.log</code>) until SMTP is wired up.</p></div></div>${
    list.length
      ? `<section class="panel">${table(["When", "To", "Subject", "Category"], list.map((m) => `<tr><td><small>${esc(m.created_at)}</small></td><td>${esc(m.to_address)}</td><td>${esc(m.subject)}<details><summary>Body</summary><pre style="white-space:pre-wrap;font:12px Barlow;margin:8px 0">${esc(m.body)}</pre></details></td><td>${esc(CATEGORY_LABEL[m.category] || m.category)}</td></tr>`).join(""))}</section>`
      : '<section class="panel empty-state"><h2>Inbox is empty.</h2><p>Fighter signups and gym events will show here.</p></section>'
  }`;
}
