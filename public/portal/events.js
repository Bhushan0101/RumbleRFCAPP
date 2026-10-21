import { state } from "./state.js";
import {
  esc,
  field,
  select,
  badge,
  table,
  categorySelect,
  CATEGORIES,
} from "./shared.js";
export let eventFilter = "";
export function setEventFilter(value) {
  eventFilter = value;
}
const fighter = (id) => state.fighters.find((f) => f.id === Number(id));
const fighterName = (id) => fighter(id)?.name || "Unknown fighter";
const categories = (event) =>
  Array.isArray(event.categories)
    ? event.categories
    : JSON.parse(event.categories || JSON.stringify(CATEGORIES));
export function eventForm(event = {}) {
  const accepted = categories(event);
  return `<form data-form="event" data-id="${event.id || ""}"><div class="two">${field("Event name", "title", event.title || "")}${field("Edition / subtitle", "subtitle", event.subtitle || "")}${field("Date & time", "starts_at", (event.starts_at || "").slice(0, 16), "datetime-local", false)}${field("Timezone", "timezone", event.timezone || "Europe/Dublin")}${field("Venue", "venue", event.venue || "", "text", false)}${field("City", "city", event.city || "", "text", false)}${field("Maximum fighters (optional)", "capacity", event.capacity || "", "number", false)}${field("Registration deadline (optional)", "registration_closes_at", (event.registration_closes_at || "").slice(0, 16), "datetime-local", false)}</div><fieldset><legend>Accepted categories</legend><div class="two">${CATEGORIES.map((c) => `<label class="check-line"><input type="checkbox" name="event_categories" value="${c}" ${accepted.includes(c) ? "checked" : ""}>${c}</label>`).join("")}</div></fieldset><label>Description<textarea name="description">${esc(event.description || "")}</textarea></label><div class="two"><label>Status<select name="status"><option ${event.status === "Upcoming" ? "selected" : ""}>Upcoming</option><option ${event.status === "Past" ? "selected" : ""}>Past</option></select></label><label>Registration<select name="registration_open"><option value="0">Closed</option><option value="1" ${event.registration_open ? "selected" : ""}>Open</option></select></label></div>${!event.id && state.user?.role === "admin" ? select("Promotion", "promotion_id", state.promotions, "", true) : ""}<button class="button primary">Save event</button></form>`;
}
export function eventsPage() {
  const events = state.events.filter((e) =>
    (e.title + " " + (e.city || ""))
      .toLowerCase()
      .includes(eventFilter.toLowerCase()),
  );
  return `<div class="page-heading"><div><span class="overline">THE W.U.C.O CALENDAR</span><h1>Find your next fight.</h1><p class="intro">Approved fighters can register for open events. Check category, capacity and deadline before entering.</p></div></div><label>Search events<input id="event-search" type="search" value="${esc(eventFilter)}" placeholder="Event name or city"></label><div class="portal-grid" id="event-cards">${eventCards(events)}</div>`;
}
export function eventCards(events) {
  return (
    events
      .map(
        (e) =>
          `<article class="portal-panel">${badge(e.status)} ${badge(e.availability?.open ? "Registration open" : "Registration closed")}<h2>${esc(e.title)}</h2><p class="muted">${esc(e.promotion_name || "W.U.C.O sample event")}</p><p>${esc(e.starts_at || "Date TBA")} · ${esc(e.timezone)}<br>${esc(e.venue || "Venue TBA")} ${esc(e.city || "")}</p><span class="metric">${e.registered_count}${e.capacity ? " / " + e.capacity : ""}</span><p class="muted">confirmed fighters · ${categories(e).map(esc).join(" / ")}</p><a class="portal-button" href="#event-${e.id}">View event →</a></article>`,
      )
      .join("") ||
    '<section class="panel empty-state"><p>No events match.</p></section>'
  );
}
function registrationPanel(e, registered, manage) {
  const user = state.user;
  if (!user)
    return '<p>Sign in to register. A paid and approved fighter application is required.</p><a class="button primary" href="#register">Start fighter application →</a>';
  const own = state.profile?.[0]?.athlete_id;
  const entry = state.registrations.find(
    (r) => r.event_id === e.id && r.athlete_id === own,
  );
  if (user.role === "fighter" && entry)
    return `<div class="entry-confirmation"><strong>You’re registered.</strong><p>Reference: ${esc(entry.registration_ref)}</p><p class="field-hint">Your entry is confirmed. The promoter manages matchups.</p><button class="button secondary" data-action="withdraw-entry" data-event="${e.id}" data-athlete="${own}">Withdraw entry</button></div>`;
  if (user.role === "fighter" && fighter(own)?.approval_status !== "approved")
    return '<p>Your fighter application must be paid and approved before event registration.</p><a class="button primary" href="#fighter">View my application →</a>';
  if (!e.availability?.open)
    return `<p>${esc(e.availability?.reason || "Registration is closed.")}</p>`;
  const team = state.fighters.filter((f) => state.team?.includes(f.id));
  const candidates = (manage ? state.fighters : team).filter(
    (f) =>
      f.approval_status === "approved" &&
      categories(e).includes(f.division) &&
      !registered.some((r) => r.id === f.id),
  );
  return `${candidates.length ? `<form data-form="entry" data-event="${e.id}">${select(user.role === "fighter" ? "Your fighter profile" : manage ? "Approved fighter" : "Approved team fighter", "athlete_id", candidates, user.role === "fighter" ? own : "", true)}<label class="check-line"><input type="checkbox" name="acknowledged" required>I confirm the fighter details and that I am authorised to submit this event entry.</label><p class="field-hint">No additional event entry fee is collected by this portal. The €10 application fee is separate.</p><button class="button primary">Confirm event registration</button></form>` : "<p>No eligible unregistered fighters are available for these categories.</p>"}${manage ? `<details><summary>Submit a guest fighter application</summary><p class="field-hint">The guest needs a €10 application payment and administrator approval before you can add their event entry.</p><form data-form="guest" data-event="${e.id}">${field("Fighter name", "name")}${categorySelect()}${field("Country", "country")}<button class="button secondary">Create guest application</button></form></details>` : ""}`;
}
export function eventPage(id) {
  const e = state.events.find((e) => e.id === id);
  if (!e)
    return '<h1>Event not found.</h1><a href="#events">Back to events</a>';
  const manage = state.managed_events?.includes(id);
  const registered = state.registrations
    .filter((r) => r.event_id === id)
    .map((r) => ({
      ...fighter(r.athlete_id),
      registration_ref: r.registration_ref,
    }))
    .filter((f) => f.id);
  const bouts = state.bouts.filter((b) => b.event_id === id);
  return `<a class="back-link" href="#events">← All events</a><div class="page-heading"><div><span class="overline">${esc(e.promotion_name || "W.U.C.O SAMPLE EVENT")}</span><h1>${esc(e.title)}</h1><p class="intro">${esc(e.subtitle)}</p></div>${badge(e.status)}</div><section class="panel"><p>${esc(e.starts_at || "Date TBA")} · ${esc(e.timezone)} · ${esc(e.venue || "Venue TBA")} ${esc(e.city || "")}</p><p>${esc(e.description || "")}</p><p class="muted">Categories: ${categories(e).map(esc).join(" / ")}${e.capacity ? " · Capacity " + e.capacity : ""}${e.registration_closes_at ? " · Deadline " + esc(e.registration_closes_at) : ""}</p></section><div class="portal-grid"><section class="portal-panel"><span class="metric">${registered.length}${e.capacity ? " / " + e.capacity : ""}</span><h2>Registered fighters</h2>${table(["Fighter", "Category", "Record"], registered.map((f) => `<tr><td>${esc(f.name)} ${!f.has_account ? badge("Guest") : ""}</td><td>${esc(f.division)}</td><td>${f.wins}–${f.losses}–${f.draws}</td></tr>`).join(""))}</section><section class="portal-panel"><h2>Event registration</h2>${registrationPanel(e, registered, manage)}</section></div><section class="portal-panel"><h2>Fight card & results</h2>${bouts.map((b) => boutCard(b, manage)).join("") || "<p>No matchups published yet.</p>"}${manage ? `<details><summary>Publish a matchup</summary><form data-form="bout" data-event="${id}"><div class="two">${select("Red corner", "red_athlete_id", registered, "", true)}${select("Blue corner", "blue_athlete_id", registered, "", true)}${categorySelect()}<label>Card section<select name="card_section"><option>Main card</option><option>Preliminary card</option></select></label></div><button class="button primary">Publish bout</button></form></details>` : ""}</section>${manage ? `<section class="panel" style="margin-top:24px"><details><summary>Edit event</summary>${eventForm(e)}</details></section>` : ""}`;
}
function boutCard(b, manage) {
  const outcome =
    b.outcome === "draw"
      ? "Draw"
      : b.outcome === "no_contest"
        ? "No contest"
        : b.winner_id
          ? fighterName(b.winner_id) + " wins"
          : "Scheduled";
  return `<article class="bout">${badge(b.card_section)} ${badge(b.division)}<div class="bout-vs"><span>${esc(fighterName(b.red_athlete_id))}</span><small>VS</small><span>${esc(fighterName(b.blue_athlete_id))}</span></div><p class="result">${esc(outcome)}${b.result_method ? " · " + esc(b.result_method) + " · R" + esc(b.result_round) + " · " + esc(b.result_time) : ""}</p>${
    manage
      ? `<details><summary>${b.outcome ? "Correct result" : "Enter fight-day result"}</summary><p class="muted">Corrections reverse the previous result before applying the replacement.</p><form data-form="result" data-bout="${b.id}"><label>Outcome<select name="outcome">${[
          ["red", "Red corner wins"],
          ["blue", "Blue corner wins"],
          ["draw", "Draw"],
          ["no_contest", "No contest"],
        ]
          .map(
            ([value, label]) =>
              `<option value="${value}" ${b.outcome === value ? "selected" : ""}>${label}</option>`,
          )
          .join(
            "",
          )}</select></label><div class="two">${field("Method", "method", b.result_method || "Decision")}${field("Round", "round", b.result_round || 1, "number")}${field("Time (MM:SS)", "time", b.result_time || "05:00")}</div><button class="button primary">Save result & update records</button></form></details>`
      : ""
  }</article>`;
}
