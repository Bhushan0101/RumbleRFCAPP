import { state, setState } from "./state.js";
import { api } from "./api.js";
import { esc, flash, icon } from "./shared.js";
import {
  signInPage,
  registrationPage,
  organizationRegistration,
  organizationFields,
  submitRegistration,
  backRegistration,
  chooseRegistrationPhoto,
  lookupRegistrationGym,
  clearRegistration,
} from "./auth.js";
import { fighterPage, gymLookupResult } from "./fighter.js";
import {
  rankingsPage,
  previewRankings,
  rankingUpload,
  clearRankingUpload,
} from "./rankings.js";
import { managementPage } from "./management.js";
import { eventPage, eventsPage, eventCards, setEventFilter } from "./events.js";
import { preparePhoto } from "./photos.js";

const root = document.querySelector("#portal-app");
const routeName = () =>
  location.hash.slice(1) ||
  (state?.user?.role === "fighter" ? "fighter" : "rankings");
function header() {
  const user = state.user;
  document.querySelector("#portal-navigation").innerHTML =
    `${user ? `<a href="#${user.role === "fighter" ? "fighter" : "account"}" data-nav="profile">${user.role === "fighter" ? "My profile" : "My workspace"}</a>` : ""}<a href="#rankings" data-nav="rankings">Rankings</a><a href="#events" data-nav="events">Events</a>`;
  document.querySelector("#account-controls").innerHTML = user
    ? `<a href="#${user.role === "fighter" ? "fighter" : "account"}" class="account-chip"><span>${esc(user.name[0])}</span><strong>${esc(user.name.split(" ")[0])}</strong></a><button type="button" class="button ghost signout" data-action="logout">Sign out</button>`
    : '<a href="#account" class="signin-link">Sign in</a><a href="#register" class="button primary">Join RFC ' +
      icon("arrow") +
      "</a>";
  const route = routeName();
  document.querySelectorAll("[data-nav]").forEach((a) => {
    const active =
      a.dataset.nav === "rankings"
        ? route.startsWith("rankings")
        : a.dataset.nav === "events"
          ? route.startsWith("event")
          : ["fighter", "account"].includes(route);
    if (active) a.setAttribute("aria-current", "page");
  });
  document.querySelector("#demo-banner").hidden = !state.demo_mode;
}
export function render() {
  clearRankingUpload();
  header();
  const route = routeName();
  if (route === "register" && !state.user) root.innerHTML = registrationPage();
  else if (route === "register-organization" && !state.user)
    root.innerHTML = organizationRegistration();
  else if (
    [
      "fighter",
      "account",
      "signin",
      "register",
      "directory",
      "register-organization",
    ].includes(route)
  )
    root.innerHTML = state.user
      ? state.user.role === "fighter"
        ? fighterPage()
        : managementPage()
      : signInPage();
  else if (/^event-\d+$/.test(route))
    root.innerHTML = eventPage(Number(route.slice(6)));
  else if (route === "events") root.innerHTML = eventsPage();
  else if (route === "ranking-management" && state.user?.role === "admin")
    root.innerHTML = managementPage();
  else
    root.innerHTML = rankingsPage(
      route === "rankings-lightweight" ? "Lightweight" : "Featherweight",
    );
  document.title =
    (route.startsWith("ranking")
      ? "Rankings"
      : route === "events"
        ? "Events"
        : state.user?.role === "fighter"
          ? "My fighter profile"
          : "Member portal") + " | RFC";
}
async function refresh() {
  setState(await api("state"));
  render();
}
function navigate(route) {
  if (routeName() === route) render();
  else location.hash = route;
}

// Keep form orchestration here; feature modules own their markup and domain-specific behaviour.
document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-form]");
  if (!form) return;
  event.preventDefault();
  const button = form.querySelector('button:not([type]),button[type="submit"]');
  if (button) {
    button.disabled = true;
    button.dataset.label = button.innerHTML;
    button.textContent = "Saving…";
  }
  const data = Object.fromEntries(new FormData(form));
  let message = "Saved successfully.";
  try {
    switch (form.dataset.form) {
      case "fighter-register": {
        const result = await submitRegistration(form);
        if (!result.complete) {
          render();
          return;
        }
        await refresh();
        navigate("fighter");
        flash(
          result.photoError
            ? "Your account is ready. Please upload your photo from your profile: " +
                result.photoError
            : "Welcome to RFC. Your fighter profile is ready.",
          !!result.photoError,
        );
        return;
      }
      case "login":
        await api("login", "POST", data);
        await refresh();
        navigate(state.user.role === "fighter" ? "fighter" : "account");
        flash("Welcome back.");
        return;
      case "register":
        await api("register", "POST", data);
        await api("login", "POST", {
          email: data.email,
          password: data.password,
        });
        await refresh();
        navigate("account");
        flash("Your account is ready.");
        return;
      case "fighter-profile":
        await api("profile", "PUT", data);
        message = "Your profile has been updated.";
        break;
      case "fighter-photo":
        await api("profile/photo", "PUT", {
          file: await preparePhoto(form.elements.photo.files[0]),
        });
        message = "Your fighter photo has been updated.";
        break;
      case "fighter-gym":
        await api("profile", "PUT", {
          gym_code: data.gym_code,
          coach_id: data.coach_id || "",
        });
        message = data.gym_code
          ? "Your gym connection has been updated."
          : "You are now registered as an independent fighter.";
        break;
      case "profile":
        await api("profile", "PUT", data);
        break;
      case "event": {
        data.registration_open = Number(data.registration_open);
        const result = await api(
          "events" + (form.dataset.id ? "/" + form.dataset.id : ""),
          form.dataset.id ? "PUT" : "POST",
          data,
        );
        await refresh();
        navigate("event-" + (form.dataset.id || result.id));
        flash("Your event has been saved.");
        return;
      }
      case "entry":
        await api("events/" + form.dataset.event + "/register", "POST", data);
        message = "Registration confirmed. You’re on the event list.";
        break;
      case "guest":
        await api("events/" + form.dataset.event + "/register", "POST", {
          ...data,
          outside: true,
        });
        break;
      case "bout":
        await api("events/" + form.dataset.event + "/bouts", "POST", data);
        break;
      case "result":
        await api("bouts/" + form.dataset.bout + "/result", "PUT", data);
        break;
      case "rankings":
        await api("rankings", "PUT", data);
        break;
      case "ranking-excel":
        await previewRankings(form);
        return;
      default:
        return;
    }
    await refresh();
    flash(message);
  } catch (error) {
    flash(error.message, true);
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = button.dataset.label;
    }
  }
});

document.addEventListener("click", async (event) => {
  const action = event.target.closest("[data-action]");
  const demo = event.target.closest("[data-demo]");
  if (demo) {
    const form = document.querySelector('[data-form="login"]');
    form.elements.email.value = demo.dataset.demo + "@demo.rfc.test";
    form.elements.password.value = "RfcDemo2026!";
    form.elements.email.focus();
    return;
  }
  if (!action) return;
  try {
    switch (action.dataset.action) {
      case "logout":
        await api("logout", "POST", {});
        clearRegistration();
        await refresh();
        navigate("account");
        flash("You have signed out.");
        break;
      case "dismiss-notice":
        document.querySelector("#notice").innerHTML = "";
        break;
      case "registration-back":
        backRegistration(action.closest("form"));
        render();
        break;
      case "registration-gym":
        await lookupRegistrationGym(action.closest("form"));
        break;
      case "profile-gym": {
        const form = action.closest("form");
        const result = await api("gym/lookup", "POST", {
          code: form.elements.gym_code.value,
        });
        document.querySelector("#profile-gym-result").innerHTML =
          gymLookupResult(result);
        break;
      }
      case "confirm-rankings":
        if (rankingUpload) {
          action.disabled = true;
          const result = await api("rankings/import", "POST", {
            ...rankingUpload,
            preview: false,
          });
          await refresh();
          flash("Published " + result.imported + " rankings.");
        }
        break;
    }
  } catch (error) {
    flash(error.message, true);
    action.disabled = false;
  }
});
document.addEventListener("change", (event) => {
  if (event.target.id === "register-role")
    document.querySelector("#organization-fields").innerHTML =
      organizationFields(event.target.value);
  if (event.target.id === "registration-photo")
    try {
      chooseRegistrationPhoto(event.target.files[0]);
    } catch (error) {
      event.target.value = "";
      flash(error.message, true);
    }
  if (event.target.id === "profile-photo" && event.target.files[0]) {
    const file = event.target.files[0];
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      event.target.value = "";
      flash("Choose a JPEG, PNG or WebP photo smaller than 10 MB.", true);
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.className = "avatar avatar-photo";
    image.alt = "Your selected fighter photo";
    image.onload = () => URL.revokeObjectURL(url);
    image.src = url;
    document.querySelector("#profile-photo-preview").replaceChildren(image);
  }
});
document.addEventListener("input", (event) => {
  if (event.target.id === "event-search") {
    setEventFilter(event.target.value);
    document.querySelector("#event-cards").innerHTML = eventCards(
      state.events.filter((e) =>
        (e.title + " " + (e.city || ""))
          .toLowerCase()
          .includes(event.target.value.toLowerCase()),
      ),
    );
  }
});
window.addEventListener("hashchange", () => {
  if (state) {
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
  }
});
refresh().catch((error) => {
  root.innerHTML =
    '<div class="empty-state"><h1>Your corner is taking a moment.</h1><p>Refresh the page in a moment. If this continues, check the server startup logs.</p><button class="button secondary" onclick="location.reload()">Try again</button></div>';
  flash(error.message, true);
});
