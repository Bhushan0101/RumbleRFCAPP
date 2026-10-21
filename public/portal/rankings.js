import { state } from "./state.js";
import { api } from "./api.js";
import {
  esc,
  table,
  avatar,
  record,
  icon,
  CATEGORIES,
  field,
  select,
} from "./shared.js";
export let rankingUpload = null;
export function clearRankingUpload() {
  rankingUpload = null;
}
export function rankingExcelForm() {
  return `<section class="portal-panel"><h2>UPLOAD EXCEL RANKINGS</h2><p class="muted">Download the populated template, change ranking positions, then upload the .xlsx file. Each included division is replaced in full; divisions absent from the file stay unchanged. Preview changes before publishing.</p><a class="portal-button secondary" href="/api/portal/rankings/template" download="RFC-rankings-template.xlsx">Download Excel template ↓</a><form data-form="ranking-excel" style="margin-top:18px"><label>Rankings workbook (.xlsx, maximum 512 KiB)<input name="workbook" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required></label><button>Validate & preview upload</button></form><div id="ranking-preview" aria-live="polite"></div></section>`;
}
export async function previewRankings(form) {
  const file = form.elements.workbook.files[0];
  if (
    !file ||
    !file.name.toLowerCase().endsWith(".xlsx") ||
    file.size > 512 * 1024
  )
    throw new Error("Choose an .xlsx file no larger than 512 KiB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  rankingUpload = null;
  const encoded = btoa(binary);
  const result = await api("rankings/import", "POST", {
    file: encoded,
    preview: true,
  });
  rankingUpload = { file: encoded, revision: result.revision };
  document.querySelector("#ranking-preview").innerHTML =
    `<h3>Review before publishing</h3><p>${result.rows.length} rankings across ${esc(result.divisions.join(", "))}. ${result.removed.length} existing ranked fighters will become unranked.</p>${table(["Division", "Fighter", "Old position", "New position"], result.rows.map((r) => `<tr><td>${esc(r.division)}</td><td>${esc(r.name)}</td><td>${esc(r.previous_position ?? "Unranked")}</td><td>${r.position}</td></tr>`).join(""))}${result.removed.length ? `<p class="alert">Will become unranked: ${result.removed.map((r) => esc(r.name) + " (" + esc(r.division) + ")").join(", ")}</p>` : ""}<button type="button" data-action="confirm-rankings" style="margin-top:18px">Confirm & publish rankings</button>`;
}

export function rankingsPage(category = "Featherweight") {
  const rankings = state.rankings
    .filter((r) => r.division === category)
    .sort((a, b) => a.position - b.position)
    .map((r) => ({
      ...r,
      fighter: state.fighters.find((f) => f.id === r.athlete_id),
    }))
    .filter((r) => r.fighter);
  const leader = rankings[0];
  const own = state.profile?.[0]?.athlete_id;
  const updated = rankings
    .map((r) => r.updated_at)
    .filter(Boolean)
    .sort()
    .at(-1);
  return `<div class="page-heading"><div><span class="overline">THE STANDARD. THE CHALLENGE.</span><h1>The rankings.</h1><p class="intro">Two categories. One place to see where the division stands.</p></div>${state.user?.role === "admin" ? '<a class="button secondary" href="#ranking-management">Manage rankings →</a>' : !state.user ? '<a class="button primary" href="#register">Create fighter profile ' + icon("arrow") + "</a>" : ""}</div><div class="ranking-toolbar"><nav class="category-tabs" aria-label="Ranking category">${CATEGORIES.map((c) => `<a href="#rankings-${c.toLowerCase()}" class="${c === category ? "active" : ""}" ${c === category ? 'aria-current="page"' : ""}>${c}<span>${state.rankings.filter((r) => r.division === c).length}</span></a>`).join("")}</nav><p class="muted">${updated ? "Updated " + esc(updated.split("T")[0].split(" ")[0]) : "Sample division standings"}</p></div>${leader ? `<div class="ranking-layout"><aside class="leader-card"><span class="overline">${esc(category.toUpperCase())}</span><div class="leader-number">01<span>DIVISION LEADER</span></div>${avatar(leader.fighter, "avatar-leader")}<h2>${esc(leader.fighter.name)}</h2><p>${esc(leader.fighter.country)}</p><div class="leader-record"><strong>${record(leader.fighter)}</strong><span>WIN · LOSS · DRAW</span></div><div class="leader-rule"></div><p class="muted">Standings are published by the RFC administrator. Results update records separately.</p></aside><section class="panel ranking-list"><div class="panel-heading"><h2>${esc(category)}</h2><span class="badge">${rankings.length} ranked fighters</span></div>${table(["Rank", "Fighter", "Record", "Movement"], rankings.map((r) => `<tr class="${r.athlete_id === own ? "own-rank" : ""}"><td><span class="rank-number">${String(r.position).padStart(2, "0")}</span></td><td><div class="rank-fighter">${avatar(r.fighter)}<div><strong>${esc(r.fighter.name)}${r.athlete_id === own ? '<span class="you-label">YOU</span>' : ""}</strong><span>${esc(r.fighter.country)}</span></div></div></td><td class="record-cell">${record(r.fighter)}</td><td><span class="movement">${r.movement > 0 ? "↑ " + r.movement : r.movement < 0 ? "↓ " + -r.movement : "—"}</span></td></tr>`).join(""))}<p class="field-hint ranking-footnote">Sample standings · Only Featherweight and Lightweight are currently open.</p></section></div>` : '<section class="panel empty-state"><h2>The first chapter is yours.</h2><p>No rankings are published for this category yet.</p></section>'}${!state.user ? '<section class="join-strip"><div><span class="overline">YOUR NAME BELONGS HERE.</span><h2>Start with your fighter profile.</h2></div><a class="button primary" href="#register">Join RFC ' + icon("arrow") + "</a></section>" : ""}`;
}
