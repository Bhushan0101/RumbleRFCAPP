import { state } from "./state.js";
import { api } from "./api.js";
import { esc, field, select, CATEGORIES, icon } from "./shared.js";
import { preparePhoto } from "./photos.js";

let step = 1;
let draft = {
  role: "fighter",
  division: "Featherweight",
  gym_code: "",
  coach_id: "",
};
let selectedPhoto = null;
let photoPreview = "";
let chosenGym = null;

export function clearRegistration() {
  step = 1;
  draft = {
    role: "fighter",
    division: "Featherweight",
    gym_code: "",
    coach_id: "",
  };
  selectedPhoto = null;
  chosenGym = null;
  if (photoPreview) URL.revokeObjectURL(photoPreview);
  photoPreview = "";
}
export function rememberRegistration(form) {
  Object.assign(draft, Object.fromEntries(new FormData(form)));
}
export function backRegistration(form) {
  rememberRegistration(form);
  step = Math.max(1, step - 1);
}
export function chooseRegistrationPhoto(file) {
  if (!file) return;
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error("Choose a JPEG, PNG or WebP photo smaller than 10 MB.");
  if (photoPreview) URL.revokeObjectURL(photoPreview);
  selectedPhoto = file;
  photoPreview = URL.createObjectURL(file);
  const preview = document.querySelector("#registration-photo-preview");
  if (preview)
    preview.innerHTML = `<img class="avatar avatar-large" src="${esc(photoPreview)}" alt="Your selected photo"><span>${esc(file.name)}</span>`;
}
const story = () =>
  `<aside class="auth-story"><a href="index.html" class="wordmark">RFC<span>.</span></a><div><span class="overline">YOUR NEXT CHAPTER</span><h2>Every fighter<br>starts somewhere.</h2><p>Your profile. Your corner. Your next fight.</p></div><div class="story-mark">01 <span>BUILD YOUR FIGHTER PROFILE</span></div></aside>`;
const demoAccounts = () =>
  state.demo_mode
    ? `<details class="demo-accounts"><summary>Try a demo account</summary><p class="muted">Password: <code>RfcDemo2026!</code></p><div class="demo-roles">${["fighter", "admin", "promoter", "gym", "coach"].map((role) => `<button class="button ghost" type="button" data-demo="${role}">${esc(role)}</button>`).join("")}</div></details>`
    : "";

export function signInPage() {
  return `<div class="auth-layout">${story()}<section class="auth-card"><span class="overline">WELCOME BACK</span><h1>Back in your corner.</h1><p class="intro">Sign in to manage your profile and your next fight.</p><form data-form="login">${field("Email address", "email", "", "email")}${field("Password", "password", "", "password")}<button class="button primary">Sign in ${icon("arrow")}</button></form><p class="auth-switch">New to RFC? <a href="#register">Create your fighter profile</a></p>${demoAccounts()}</section></div>`;
}

export function registrationPage() {
  return `<div class="auth-layout registration-layout">${story()}<section class="auth-card"><div class="auth-topline"><span class="overline">JOIN THE ROSTER</span><span class="muted">Step ${step} of 3</span></div><h1>${["Create your account.", "Make it yours.", "Ready to step in?"][step - 1]}</h1><p class="intro">${["A few details to start your fighter journey.", "Choose your category and introduce yourself.", "Check your details before joining RFC."][step - 1]}</p><ol class="stepper" aria-label="Registration progress">${["Account", "Fighter profile", "Review"].map((label, i) => `<li class="${step === i + 1 ? "current" : step > i + 1 ? "done" : ""}" ${step === i + 1 ? 'aria-current="step"' : ""}><span>${step > i + 1 ? "✓" : i + 1}</span>${label}</li>`).join("")}</ol><form data-form="fighter-register" id="fighter-registration">${registrationStep()}<div class="form-actions">${step > 1 ? '<button type="button" class="button secondary" data-action="registration-back">Back</button>' : ""}<button class="button primary">${step === 3 ? "Create fighter account" : "Continue"} ${icon("arrow")}</button></div></form><p class="auth-switch">Already registered? <a href="#account">Sign in</a></p><a class="subtle-link" href="#register-organization">Register a gym, coach or promotion →</a></section></div>`;
}

function registrationStep() {
  if (step === 1)
    return `${field("Full name", "name", draft.name || "")}${field("Email address", "email", draft.email || "", "email")}${field("Create a password", "password", draft.password || "", "password")}<p class="field-hint">Use at least 10 characters. Your password stays private.</p>`;
  if (step === 2)
    return `<div class="photo-picker"><div id="registration-photo-preview">${photoPreview ? `<img class="avatar avatar-large" src="${esc(photoPreview)}" alt="Your selected photo">` : `<span class="avatar avatar-large avatar-placeholder">${icon("camera")}</span>`}</div><div><strong>Add your fighter photo</strong><p class="field-hint">Optional · JPG, PNG or WebP, up to 10 MB.</p><label class="button secondary file-button">Choose photo<input type="file" name="photo" id="registration-photo" accept="image/jpeg,image/png,image/webp"></label></div></div><fieldset class="category-field"><legend>Choose your category</legend><div class="category-options">${CATEGORIES.map((category) => `<label class="category-option"><input type="radio" name="division" value="${category}" ${draft.division === category ? "checked" : ""} required><span>${category}</span>${icon("check")}</label>`).join("")}</div></fieldset>${field("Country", "country", draft.country || "")}<details class="gym-connect" ${chosenGym ? "open" : ""}><summary>Connect my gym <span class="muted">Optional</span></summary><p class="field-hint">Have a gym? Ask them for their invitation code. You can also join independently.</p><div class="inline-input">${field("Gym invitation code", "gym_code", draft.gym_code || "", "text", false)}<button class="button secondary" type="button" data-action="registration-gym">Find gym</button></div><div id="registration-gym-result">${gymChoice()}</div></details>`;
  return `<div class="review-profile">${photoPreview ? `<img src="${esc(photoPreview)}" class="avatar avatar-large" alt="Your selected photo">` : `<span class="avatar avatar-large avatar-placeholder">${esc((draft.name || "F")[0])}</span>`}<div><h2>${esc(draft.name)}</h2><p>${esc(draft.division)} · ${esc(draft.country)}</p></div></div><dl class="review-list"><div><dt>Email</dt><dd>${esc(draft.email)}</dd></div><div><dt>Gym</dt><dd>${esc(chosenGym?.gym.name || "Independent fighter")}</dd></div><div><dt>Coach</dt><dd>${esc(chosenGym?.coaches.find((c) => String(c.id) === String(draft.coach_id))?.name || "Not linked")}</dd></div></dl><div class="quiet-note">${icon("person")}<p>You can edit your profile, photo and gym connection after registering. Fight records are updated from event results.</p></div>`;
}
function gymChoice() {
  return chosenGym
    ? `<div class="gym-found">${icon("gym")}<div><strong>${esc(chosenGym.gym.name)}</strong><p class="muted">${esc(chosenGym.gym.city)}</p></div></div>${select("Coach (optional)", "coach_id", chosenGym.coaches, draft.coach_id)}`
    : "";
}
export async function lookupRegistrationGym(form) {
  rememberRegistration(form);
  if (!draft.gym_code.trim()) {
    chosenGym = null;
    draft.coach_id = "";
    document.querySelector("#registration-gym-result").innerHTML = "";
    return;
  }
  chosenGym = await api("gym/lookup", "POST", { code: draft.gym_code });
  draft.gym_code = draft.gym_code.toUpperCase();
  document.querySelector("#registration-gym-result").innerHTML = gymChoice();
}
export async function submitRegistration(form) {
  rememberRegistration(form);
  if (step === 2) {
    if (draft.gym_code.trim()) {
      // Resolve the code again at submit time rather than trusting a stale lookup.
      chosenGym = await api("gym/lookup", "POST", { code: draft.gym_code });
      if (
        !chosenGym.coaches.some((c) => String(c.id) === String(draft.coach_id))
      )
        draft.coach_id = "";
    } else {
      chosenGym = null;
      draft.coach_id = "";
    }
  }
  if (step < 3) {
    step++;
    return { complete: false };
  }
  const payload = {
    role: "fighter",
    name: draft.name,
    email: draft.email,
    password: draft.password,
    division: draft.division,
    country: draft.country,
    gym_code: draft.gym_code,
    coach_id: draft.coach_id,
  };
  await api("register", "POST", payload);
  await api("login", "POST", { email: draft.email, password: draft.password });
  let photoError = "";
  if (selectedPhoto) {
    try {
      await api("profile/photo", "PUT", {
        file: await preparePhoto(selectedPhoto),
      });
    } catch (error) {
      photoError = error.message;
    }
  }
  clearRegistration();
  return { complete: true, photoError };
}

export function organizationRegistration() {
  return `<div class="narrow-page"><a class="back-link" href="#register">← Fighter registration</a><section class="panel"><span class="overline">GROW YOUR CORNER</span><h1>Join your organisation.</h1><p class="intro">Create a gym, coach or promotion account.</p><form data-form="register"><label>Account type<select name="role" id="register-role"><option value="gym">Gym</option><option value="coach">Coach</option><option value="promoter">Promoter</option></select></label>${field("Full name", "name")}${field("Email address", "email", "", "email")}${field("Create a password", "password", "", "password")}<div id="organization-fields">${organizationFields("gym")}</div><button class="button primary">Create account ${icon("arrow")}</button></form></section></div>`;
}
export function organizationFields(role) {
  return role === "coach"
    ? `${field("Gym invitation code (optional)", "gym_code", "", "text", false)}`
    : `${field(role === "gym" ? "Gym name" : "Promotion name", "organization")}${role === "gym" ? field("City", "city", "", "text", false) : ""}`;
}
