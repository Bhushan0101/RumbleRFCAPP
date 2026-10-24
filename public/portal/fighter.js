import { state } from "./state.js";
import {
  esc,
  field,
  select,
  categorySelect,
  avatar,
  record,
  icon,
  table,
} from "./shared.js";

function applicationStatusCard(application) {
  if (!application) return "";
  if (application.approval_status === "approved") return "";
  const msg = {
    pending_approval: "Your application is awaiting administrator approval. You can edit your profile below; event entry unlocks when you are approved.",
    rejected: "Your application was declined." + (application.review_note ? " Admin note: " + application.review_note : ""),
    suspended: "Your profile is currently suspended." + (application.review_note ? " Admin note: " + application.review_note : ""),
  }[application.approval_status] || "Your application is being reviewed.";
  return `<section class="panel"><span class="overline">APPLICATION STATUS</span><p>${esc(msg)}</p></section>`;
}

function sectionProfile(fighter) {
  return `<section class="panel"><div class="panel-heading"><div><span class="overline">THE INTRODUCTION</span><h2>Profile details</h2></div><span class="muted">Only you can edit these details</span></div><form data-form="fighter-profile"><div class="two">${field("Full name", "name", fighter.name)}${field("Nickname (optional)", "nickname", fighter.nickname || "", "text", false)}${categorySelect(fighter.division)}${field("Country", "country", fighter.country)}</div><label>About you <span class="optional">Optional</span><textarea name="biography" maxlength="2000" placeholder="Tell us a little about your training and your journey.">${esc(fighter.biography || "")}</textarea></label><div class="form-footer"><p class="field-hint">Records come from fight results. A ranked category change needs an administrator.</p><button class="button primary">Save profile ${icon("check")}</button></div></form></section>`;
}

export const ownFighter = () =>
  state.fighters.find((f) => f.id === state.profile?.[0]?.athlete_id);
export function fighterPage() {
  const fighter = ownFighter();
  if (!fighter)
    return '<div class="empty-state"><h1>Your fighter profile is not available.</h1><a href="#account">Back to your account</a></div>';
  const gym = state.gyms.find((g) => g.id === fighter.gym_id);
  const coach = state.coaches.find((c) => c.id === fighter.coach_id);
  const ranking = state.rankings.find(
    (r) => r.athlete_id === fighter.id && r.division === fighter.division,
  );
  const entries = state.registrations
    .filter((r) => r.athlete_id === fighter.id)
    .map((r) => state.events.find((e) => e.id === r.event_id))
    .filter(Boolean);
  const bouts = state.bouts.filter(
    (b) => b.red_athlete_id === fighter.id || b.blue_athlete_id === fighter.id,
  );
  return `<div class="page-heading"><div><span class="overline">YOUR CORNER</span><h1>${fighter.approval_status === "approved" ? "Your fighter profile." : "Your fighter application."}</h1><p class="intro">Make your introduction. Keep your details ready for the next fight.</p></div><div style="display:flex;gap:10px;flex-wrap:wrap">${fighter.fighter_no ? `<a class="button primary" href="/passport.html?no=${encodeURIComponent(fighter.fighter_no)}" target="_blank" rel="noopener">${icon("trophy")} My digital passport</a>` : ""}<a class="button secondary" href="#rankings">${icon("trophy")} View rankings</a></div></div>${applicationStatusCard(state.my_applications?.find((a) => a.athlete_id === fighter.id))}<div class="fighter-layout"><div class="fighter-main"><section class="panel profile-summary"><div class="profile-identity">${avatar(fighter, "avatar-hero")}<div><span class="badge accent">${esc(fighter.division)}</span><h2>${esc(fighter.name)}</h2><p class="muted">${fighter.nickname ? "“" + esc(fighter.nickname) + "” · " : ""}${esc(fighter.country)}${fighter.fighter_no ? " · " + esc(fighter.fighter_no) : ""}</p></div></div><div class="profile-stats"><div><strong>${fighter.wins}</strong><span>Wins</span></div><div><strong>${fighter.losses}</strong><span>Losses</span></div><div><strong>${fighter.draws}</strong><span>Draws</span></div><div><strong>${ranking ? "#" + ranking.position : "—"}</strong><span>${ranking ? "Category rank" : "Not ranked yet"}</span></div></div></section>${sectionProfile(fighter)}<section class="panel"><div class="panel-heading"><div><span class="overline">YOUR NEXT APPEARANCE</span><section class="panel"><div class="panel-heading"><div><span class="overline">YOUR NEXT APPEARANCE</span><h2>My event registrations</h2></div><a class="text-link" href="#events">Explore events →</a></div>${entries.length ? entries.map((e) => `<a class="event-entry" href="#event-${e.id}"><span class="entry-icon">${icon("calendar")}</span><div><strong>${esc(e.title)}</strong><p class="muted">${esc(e.venue || "Venue to be announced")} · ${esc(e.status)}</p></div>${icon("arrow")}</a>`).join("") : `<div class="empty-state compact"><p>You haven’t registered for an event yet.</p><a class="button secondary" href="#events">Find your first event ${icon("arrow")}</a></div>`}</section>${
    bouts.length
      ? `<section class="panel"><h2>Fight history</h2>${table(
          ["Event", "Opponent", "Result"],
          bouts
            .map((b) => {
              const event = state.events.find((e) => e.id === b.event_id);
              const opponent = state.fighters.find(
                (f) =>
                  f.id ===
                  (b.red_athlete_id === fighter.id
                    ? b.blue_athlete_id
                    : b.red_athlete_id),
              );
              const result =
                b.outcome === "draw"
                  ? "Draw"
                  : b.outcome === "no_contest"
                    ? "No contest"
                    : b.winner_id
                      ? b.winner_id === fighter.id
                        ? "Win"
                        : "Loss"
                      : "Scheduled";
              return `<tr><td>${esc(event?.title || "Event")}</td><td>${esc(opponent?.name || "Opponent")}</td><td>${esc(result)}</td></tr>`;
            })
            .join(""),
        )}</section>`
      : ""
  }</div><aside class="fighter-aside"><section class="panel"><div class="panel-heading"><h2>Fighter photo</h2>${icon("camera")}</div><form data-form="fighter-photo"><div class="photo-editor" id="profile-photo-preview">${avatar(fighter, "avatar-photo")}</div><label class="upload-zone">${icon("camera")}<strong>Choose a photo</strong><span>JPG, PNG or WebP · up to 10 MB</span><input type="file" name="photo" id="profile-photo" accept="image/jpeg,image/png,image/webp" required></label><p class="field-hint">A clear portrait helps your profile stand out. Your photo also appears in rankings.</p><button class="button secondary full-width">Upload photo</button></form></section><section class="panel gym-card"><div class="panel-heading"><h2>My gym</h2>${icon("gym")}</div>${gym ? `<span class="gym-symbol">${icon("gym")}</span><h3>${esc(gym.name)}</h3><p class="muted">${esc(gym.city || "Your training home")}</p><div class="coach-line"><span>My coach</span><strong>${esc(coach?.name || "Not linked")}</strong></div>` : '<div class="empty-state compact"><span class="gym-symbol">' + icon("gym") + '</span><h3>Independent fighter</h3><p class="muted">Your own path. Connect a gym whenever you’re ready.</p></div>'}<details><summary>${gym ? "Update gym connection" : "Connect my gym"}</summary><form data-form="fighter-gym"><p class="field-hint">Enter a gym invitation code to connect. Leave the code blank to train independently.</p><div class="inline-input">${field("Gym invitation code", "gym_code", "", "text", false)}<button type="button" class="button secondary" data-action="profile-gym">Find</button></div><div id="profile-gym-result"></div><button class="button secondary full-width">Save gym connection</button></form></details></section><div class="quiet-note">${icon("check")}<p>Your profile is yours. Your gym connection is shown only in your own workspace.</p></div></aside></div>`;
}
export function gymLookupResult(result) {
  return `<div class="gym-found">${icon("gym")}<div><strong>${esc(result.gym.name)}</strong><p class="muted">${esc(result.gym.city)}</p></div></div>${select("Coach (optional)", "coach_id", result.coaches)}`;
}
