// Event feature: existing entry, promotion ownership, cards and results.
import { state } from "./state.js";
import { esc, field, select, badge, table, categorySelect } from "./shared.js";
export let eventFilter = "";
export function setEventFilter(value) {
  eventFilter = value;
}
const fighter = (id) => state.fighters.find((f) => f.id === Number(id));
const fighterName = (id) => fighter(id)?.name || "Unknown fighter";
export function eventForm(event = {}) {
  return `<form data-form="event" data-id="${event.id || ""}"><div class="two">${field("Event name", "title", event.title || "")}${field("Edition / subtitle", "subtitle", event.subtitle || "")}${field("Date & time", "starts_at", event.starts_at || "", "datetime-local", false)}${field("Timezone", "timezone", event.timezone || "Europe/Dublin")}${field("Venue", "venue", event.venue || "", "text", false)}${field("City", "city", event.city || "", "text", false)}</div><label>Description<textarea name="description">${esc(event.description || "")}</textarea></label><div class="two"><label>Status<select name="status"><option ${event.status === "Upcoming" ? "selected" : ""}>Upcoming</option><option ${event.status === "Past" ? "selected" : ""}>Past</option></select></label><label>Registration<select name="registration_open"><option value="0">Closed</option><option value="1" ${event.registration_open ? "selected" : ""}>Open</option></select></label></div>${!event.id && state.user?.role === "admin" ? select("Promotion", "promotion_id", state.promotions, "", true) : ""}<button>Save event</button></form>`;
}
export function eventsPage() {
  const events = state.events.filter((e) =>
    (e.title + " " + (e.city || ""))
      .toLowerCase()
      .includes(eventFilter.toLowerCase()),
  );
  return `<span class="eyebrow">The competition hub</span><h1>FIND YOUR NEXT FIGHT.</h1><p class="intro">Explore sample events, see who's registered and follow the published fight cards and results.</p><label>Search events<input id="event-search" type="search" value="${esc(eventFilter)}" placeholder="Event name or city"></label><div class="portal-grid" id="event-cards">${eventCards(events)}</div>`;
}
export function eventCards(events) {
  return (
    events
      .map(
        (e) =>
          `<article class="portal-panel">${badge(e.status)}${badge(e.registration_open && e.status === "Upcoming" ? "Registration open" : "Registration closed")}<h2>${esc(e.title)}</h2><p class="muted">${esc(e.promotion_name || "RFC sample event")}</p><p>${esc(e.starts_at || "Date TBA")} · ${esc(e.timezone)}<br>${esc(e.venue || "Venue TBA")} ${esc(e.city || "")}</p><span class="metric">${e.registered_count}</span><p class="muted">registered fighters · ${state.bouts.filter((b) => b.event_id === e.id).length} published bouts</p><a class="portal-button" href="#event-${e.id}">View event ↗</a></article>`,
      )
      .join("") || "<p>No events match.</p>"
  );
}
export function eventPage(id) {
  const e = state.events.find((e) => e.id === id);
  if (!e) return '<h1>Event not found</h1><a href="#events">Back to events</a>';
  const manage = state.managed_events?.includes(id);
  const registered = state.registrations
    .filter((r) => r.event_id === id)
    .map((r) => fighter(r.athlete_id))
    .filter(Boolean);
  const team = state.fighters.filter((f) => state.team?.includes(f.id));
  const bouts = state.bouts.filter((b) => b.event_id === id);
  return `<a href="#events">← All events</a><p class="eyebrow">${esc(e.promotion_name || "RFC sample event")}</p><h1>${esc(e.title)}</h1><p>${esc(e.subtitle)} · ${badge(e.status)}${badge(e.registration_open ? "Registration open" : "Registration closed")}</p><p>${esc(e.starts_at || "Date TBA")} · ${esc(e.timezone)} · ${esc(e.venue || "Venue TBA")} ${esc(e.city || "")}</p><p>${esc(e.description || "")}</p><div class="portal-grid"><section class="portal-panel"><span class="metric">${registered.length}</span><h2>REGISTERED FIGHTERS</h2>${table(["Fighter", "Division", "Record"], registered.map((f) => `<tr><td>${esc(f.name)} ${!f.has_account ? '<span class="badge gold">Guest</span>' : ""}</td><td>${esc(f.division)}</td><td>${f.wins}–${f.losses}–${f.draws}</td></tr>`).join(""))}</section><section class="portal-panel"><h2>EVENT REGISTRATION</h2>${
    !state.user
      ? '<p>Sign in or register to enter yourself or your team.</p><a class="portal-button" href="#account">Sign in / Register</a>'
      : e.registration_open && e.status === "Upcoming"
        ? `<form data-form="entry" data-event="${id}">${select(
            manage
              ? "Choose any existing fighter"
              : "Choose yourself / a team fighter",
            "athlete_id",
            (manage ? state.fighters : team).filter(
              (f) => !registered.some((r) => r.id === f.id),
            ),
            "",
            true,
          )}<button>Register fighter</button></form>${manage ? `<details><summary>Add a fighter without a portal account</summary><p class="muted">Creates a sample competitor profile, not a login account.</p><form data-form="guest" data-event="${id}">${field("Fighter name", "name")}${categorySelect()}${field("Country", "country")}<button>Add guest competitor</button></form></details>` : ""}`
        : "<p>Registration is closed for this event.</p>"
  }</section></div><section class="portal-panel"><h2>FIGHT CARD & RESULTS</h2>${bouts.map((b) => boutCard(b, manage)).join("") || "<p>No matchups published yet.</p>"}${manage ? `<details><summary>Publish a matchup</summary><form data-form="bout" data-event="${id}"><div class="two">${select("Red corner", "red_athlete_id", registered, "", true)}${select("Blue corner", "blue_athlete_id", registered, "", true)}${categorySelect()}<label>Card section<select name="card_section"><option>Main card</option><option>Preliminary card</option></select></label></div><button>Publish bout</button></form></details>` : ""}</section>${manage ? `<section class="portal-panel" style="margin-top:22px"><details><summary>Edit event</summary>${eventForm(e)}</details></section>` : ""}`;
}
function boutCard(b, manage) {
  let outcome =
    b.outcome === "draw"
      ? "Draw"
      : b.outcome === "no_contest"
        ? "No contest"
        : b.winner_id
          ? fighterName(b.winner_id) + " wins"
          : "Scheduled";
  return `<article class="bout">${badge(b.card_section)}${badge(b.division)}<div class="bout-vs"><span>${esc(fighterName(b.red_athlete_id))}</span><small>VS</small><span>${esc(fighterName(b.blue_athlete_id))}</span></div><p class="result">${esc(outcome)}${b.result_method ? " · " + esc(b.result_method) + " · R" + esc(b.result_round) + " · " + esc(b.result_time) : ""}</p>${
    manage
      ? `<details><summary>${b.outcome ? "Correct result" : "Enter fight-day result"}</summary><p class="muted">Saving updates both records. Corrections reverse the previous result before applying the new one.</p><form data-form="result" data-bout="${b.id}"><label>Outcome<select name="outcome">${[
          ["red", "Red corner wins"],
          ["blue", "Blue corner wins"],
          ["draw", "Draw"],
          ["no_contest", "No contest"],
        ]
          .map(
            ([v, t]) =>
              `<option value="${v}" ${b.outcome === v ? "selected" : ""}>${t}</option>`,
          )
          .join(
            "",
          )}</select></label><div class="two">${field("Method (e.g. Decision / TKO)", "method", b.result_method || "Decision")}${field("Round", "round", b.result_round || "1", "number")}${field("Time (MM:SS)", "time", b.result_time || "05:00")}</div><button>Save result & update records</button></form></details>`
      : ""
  }</article>`;
}
