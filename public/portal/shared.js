export const CATEGORIES = ["Featherweight", "Lightweight"];
export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const options = (list, selected = "", blank = "Choose…") =>
  `<option value="">${esc(blank)}</option>` +
  list
    .map(
      (x) =>
        `<option value="${esc(x.id)}" ${String(x.id) === String(selected) ? "selected" : ""}>${esc(x.name)}</option>`,
    )
    .join("");
export const field = (
  label,
  name,
  value = "",
  type = "text",
  required = true,
) =>
  `<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${required ? "required" : ""} ${type === "password" ? 'minlength="10" maxlength="128" autocomplete="current-password"' : ""}></label>`;
export const select = (label, name, list, value = "", required = false) =>
  `<label>${esc(label)}<select aria-label="${esc(label)}" name="${name}" ${required ? "required" : ""}>${options(list, value, required ? "Choose…" : "None / independent")}</select></label>`;
export const categorySelect = (value = "", name = "division") =>
  select(
    "Category",
    name,
    CATEGORIES.map((name) => ({ id: name, name })),
    value,
    true,
  );
export const badge = (value) => `<span class="badge">${esc(value)}</span>`;
export const table = (heads, body) =>
  `<div class="table-wrap"><table><thead><tr>${heads.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body || `<tr><td colspan="${heads.length}" class="empty">Nothing here yet.</td></tr>`}</tbody></table></div>`;
export const record = (fighter) =>
  `${fighter.wins}–${fighter.losses}–${fighter.draws}`;
export const photoURL = (value) =>
  /^assets\/[a-zA-Z0-9_./-]+$/.test(value || "")
    ? value
    : /^https?:\/\//.test(value || "")
      ? value
      : "";
export const avatar = (fighter, className = "") =>
  photoURL(fighter?.portrait_url)
    ? `<img class="avatar ${className}" src="${esc(photoURL(fighter.portrait_url))}" alt="${esc(fighter.name)}" loading="lazy">`
    : `<span class="avatar avatar-placeholder ${className}" aria-label="No profile photo">${esc(
        (fighter?.name || "F")
          .split(" ")
          .map((n) => n[0])
          .slice(0, 2)
          .join(""),
      )}</span>`;
export const icon = (name) =>
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">${{ arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', check: '<path d="m5 12 4 4L19 6"/>', person: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>', camera: '<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/>', gym: '<path d="M3 21V7l9-4 9 4v14M7 10h2m6 0h2M7 14h2m6 0h2M10 21v-4h4v4"/>', trophy: '<path d="M7 3h10v5a5 5 0 0 1-10 0zM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 13v7M8 21h8"/>', calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/>' }[name] || ""}</svg>`;
export function flash(message, error = false) {
  const notice = document.querySelector("#notice");
  notice.innerHTML = `<div class="alert ${error ? "error" : "success"}">${icon(error ? "person" : "check")}<span>${esc(message)}</span><button type="button" data-action="dismiss-notice" class="icon-button" aria-label="Dismiss message">×</button></div>`;
  notice.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
