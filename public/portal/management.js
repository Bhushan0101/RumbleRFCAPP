// Existing gym/coach/promotion/admin management stays separate from the fighter journey.
import { state } from "./state.js";
import { esc, field, select, badge, table, CATEGORIES } from "./shared.js";
import { eventForm } from "./events.js";
import { rankingExcelForm } from "./rankings.js";
function profileForm() {
  const user = state.user;
  if (!user || user.role === "admin") return "";
  const f = state.profile?.[0] || {};
  return `<section class="portal-panel"><details><summary>Edit my profile connections</summary><form data-form="profile">${user.role === "fighter" ? select("Gym (optional)", "gym_id", state.gyms, f.gym_id) + select("Coach (optional)", "coach_id", state.coaches, f.coach_id) : user.role === "coach" ? select("Gym (optional)", "gym_id", state.gyms, state.organization?.[0]?.gym_id) : field(user.role === "gym" ? "Gym name" : "Promotion name", "organization", state.organization?.[0]?.name || "") + (user.role === "gym" ? field("City", "city", state.organization?.[0]?.city || "", "text", false) : "")}<button>Save profile</button></form></details></section>`;
}
export function workspace() {
  const user = state.user;
  if (!user) return "";
  const managed = state.events.filter((e) =>
    state.managed_events.includes(e.id),
  );
  const team = state.fighters.filter((f) => state.team.includes(f.id));
  return `${profileForm()}<div class="portal-grid"><section class="portal-panel"><h2>${user.role === "promoter" ? "MY PROMOTION" : user.role === "admin" ? "APP OVERVIEW" : "MY CONNECTIONS"}</h2>${user.role === "gym" ? `<div class="invite-card"><span class="overline">YOUR GYM INVITATION CODE</span><strong>${esc(state.organization?.[0]?.join_code || "")}</strong><p class="muted">Share this code with fighters and coaches so they can connect.</p></div>` : ""}<span class="metric">${user.role === "admin" ? state.users.length : user.role === "promoter" ? managed.length : team.length}</span><p class="muted">${user.role === "admin" ? "registered demo members" : user.role === "promoter" ? "managed events" : "affiliated fighters"}</p>${team.map((f) => `<p>${esc(f.name)} · ${esc(f.division)} · ${f.wins}–${f.losses}–${f.draws}</p>`).join("")}${user.role === "promoter" ? `<p><strong>${new Set(state.registrations.filter((r) => managed.some((e) => e.id === r.event_id)).map((r) => r.athlete_id)).size}</strong> unique registered fighters across your events</p>` : ""}</section>${["promoter", "admin"].includes(user.role) ? `<section class="portal-panel"><h2>CREATE AN EVENT</h2>${eventForm()}</section>` : ""}</div>${managed.length ? `<section class="portal-panel"><h2>MANAGE EVENTS</h2>${managed.map((e) => `<p><a href="#event-${e.id}">${esc(e.title)} ↗</a> · ${e.registered_count} registered</p>`).join("")}</section>` : ""}${
    user.role === "admin"
      ? `${rankingExcelForm()}<div class="portal-grid"><section class="portal-panel"><h2>PUBLISH RANKINGS</h2><p class="muted">Move a fighter to a position in their division. Other positions shift automatically. Results update records; rankings remain an editorial decision.</p><form data-form="rankings">${select(
          "Fighter",
          "athlete_id",
          state.fighters.filter((f) => CATEGORIES.includes(f.division)),
          "",
          true,
        )}${field("Position", "position", "1", "number")}<button>Update rankings</button></form></section><section class="portal-panel"><h2>MEMBERS</h2>${table(["Name", "Role", "Email"], state.users.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.role)}</td><td>${esc(u.email)}</td></tr>`).join(""))}</section></div>`
      : ""
  }`;
}

export function managementPage() {
  return `<div class="page-heading"><div><span class="overline">YOUR WORKSPACE</span><h1>${esc(state.user.name)}</h1><p class="intro">${esc(state.user.role)} management</p></div><a class="button secondary" href="#events">Explore events →</a></div>${workspace()}`;
}
