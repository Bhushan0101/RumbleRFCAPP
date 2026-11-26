"use client";

import * as React from "react";
import { useActionState } from "react";
import { registerFighter, type FormState } from "@/app/actions/public";
import {
  MARTIAL_ARTS,
  classesForMartialArt,
  martialArtRequiresClass,
} from "@/lib/martial-arts";
import { GENDERS, divisionsFor } from "@/lib/divisions";
import { COUNTRIES } from "@/lib/countries";

const initial: FormState = { ok: false, message: "" };

type Step = 1 | 2 | 3 | 4;

const STEP_FIELDS: Record<Step, string[]> = {
  1: ["first_name", "last_name", "email", "password"],
  2: ["gender", "disciplines", "division"],
  3: ["date_of_birth", "country", "gym_choice", "gym_name_new", "coach_name"],
  4: ["accept_terms", "accept_privacy", "accept_accuracy"],
};

const STEP_META: { n: Step; label: string }[] = [
  { n: 1, label: "Account" },
  { n: 2, label: "Disciplines" },
  { n: 3, label: "Details" },
  { n: 4, label: "Review & submit" },
];

function stepForError(errors: Record<string, string[]> | undefined): Step | null {
  if (!errors) return null;
  const keys = Object.keys(errors);
  const inStep2 = (k: string) =>
    STEP_FIELDS[2].includes(k) || k.startsWith("disciplines");
  if (keys.some((k) => STEP_FIELDS[1].includes(k))) return 1;
  if (keys.some(inStep2)) return 2;
  if (keys.some((k) => STEP_FIELDS[3].includes(k))) return 3;
  if (keys.some((k) => STEP_FIELDS[4].includes(k))) return 4;
  return null;
}

type DiscRow = {
  martialArt: string;
  classCode: string;
  wins: number;
  losses: number;
  draws: number;
};

export type GymOption = { id: number; name: string; city: string };

export function FighterRegisterForm({ gyms = [] }: { gyms?: GymOption[] }) {
  const [state, action, pending] = useActionState(registerFighter, initial);
  const [step, setStep] = React.useState<Step>(1);
  const [gender, setGender] = React.useState<string>("");
  const [rows, setRows] = React.useState<Record<string, DiscRow>>({});
  const [primary, setPrimary] = React.useState<string>("");
  const [acceptTerms, setAcceptTerms] = React.useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = React.useState(false);
  const [acceptAccuracy, setAcceptAccuracy] = React.useState(false);
  const [stepError, setStepError] = React.useState<string>("");
  const [gymChoice, setGymChoice] = React.useState<string>("");
  const [gymNameNew, setGymNameNew] = React.useState<string>("");
  const allConsentsOk = acceptTerms && acceptPrivacy && acceptAccuracy;
  const submitIntent = React.useRef(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  const selected = Object.keys(rows);
  const effectivePrimary = primary || selected[0] || "";
  const divisions = divisionsFor(gender, effectivePrimary);
  const divisionReady = divisions.length > 0;

  // Serialize discipline grid including W-L-D so the server action can
  // persist declared records per discipline (primary mirrors onto Athlete).
  const disciplinesJson = React.useMemo(() => {
    return JSON.stringify(
      selected.map((id) => ({
        martial_art: id,
        class_code: rows[id].classCode,
        wins: rows[id].wins,
        losses: rows[id].losses,
        draws: rows[id].draws,
        is_primary: id === effectivePrimary,
      })),
    );
  }, [rows, selected, effectivePrimary]);

  function toggleDiscipline(id: string, on: boolean) {
    setRows((prev) => {
      const next = { ...prev };
      if (on) {
        if (!next[id]) {
          next[id] = { martialArt: id, classCode: "", wins: 0, losses: 0, draws: 0 };
        }
      } else {
        delete next[id];
      }
      return next;
    });
    if (!on && primary === id) setPrimary("");
  }

  function updateRow<K extends keyof DiscRow>(id: string, key: K, value: DiscRow[K]) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  }

  React.useEffect(() => {
    const target = stepForError(state.errors);
    if (target) setStep(target);
  }, [state.errors]);

  function validateStep(current: Step): boolean {
    setStepError("");
    const form = formRef.current;
    if (!form) return true;
    if (current === 2) {
      if (selected.length === 0) {
        setStepError("Pick at least one discipline.");
        return false;
      }
      for (const id of selected) {
        if (martialArtRequiresClass(id) && !rows[id].classCode) {
          setStepError(`Pick a class for ${id}.`);
          return false;
        }
      }
      if (!effectivePrimary) {
        setStepError("Mark one discipline as primary.");
        return false;
      }
    }
    if (current === 3) {
      if (!gymChoice) {
        setStepError("Pick your gym from the list — or choose \"My gym isn't listed\".");
        return false;
      }
      if (gymChoice === "new" && !gymNameNew.trim()) {
        setStepError("Type your gym's name.");
        return false;
      }
    }
    const names = STEP_FIELDS[current];
    let firstInvalid: HTMLInputElement | null = null;
    for (const name of names) {
      const nodes = form.querySelectorAll(`[name="${name}"]`);
      nodes.forEach((node) => {
        const n = node as HTMLInputElement;
        if (typeof n.checkValidity === "function" && !n.checkValidity() && !firstInvalid) {
          firstInvalid = n;
        }
      });
    }
    if (firstInvalid) {
      const el = firstInvalid as HTMLInputElement;
      el.focus();
      try {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {}
      const msg =
        el.validationMessage ||
        `Please complete the "${(el.getAttribute("name") ?? "field").replace(/_/g, " ")}" field.`;
      setStepError(msg);
      if (typeof el.reportValidity === "function") el.reportValidity();
      return false;
    }
    return true;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setStep((s) => (s === 4 ? 4 : ((s + 1) as Step)));
  }

  function goBack() {
    setStep((s) => (s === 1 ? 1 : ((s - 1) as Step)));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key !== "Enter") return;
    const target = e.target as HTMLElement;
    if (target.tagName === "TEXTAREA") return;
    if (step < 4) {
      e.preventDefault();
      e.stopPropagation();
      goNext();
      return;
    }
    if (target.tagName !== "BUTTON") {
      e.preventDefault();
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (step !== 4 || !submitIntent.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    submitIntent.current = false;
  }

  if (state.ok) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-gradient-to-br from-[#0a2f23] via-[#0b3d2e] to-[#07251b] border-2 border-emerald/60 rounded-2xl p-8 md:p-12 text-center"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald mb-5">
          <svg
            viewBox="0 0 24 24"
            className="w-8 h-8 text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="5 12 10 17 20 7" />
          </svg>
        </div>
        <h2 className="font-display font-black text-3xl md:text-4xl tracking-widest text-white mb-3">
          APPLICATION <span className="text-gold">SUBMITTED</span>
        </h2>
        <p className="text-sm md:text-base text-[#cfe3d8] max-w-xl mx-auto leading-relaxed">
          {state.message}
        </p>
        <div className="mt-8 grid gap-3 md:grid-cols-3 text-left max-w-2xl mx-auto">
          <StatusStep n={1} label="Submitted" done />
          <StatusStep n={2} label="Admin review" />
          <StatusStep n={3} label="Passport issued" />
        </div>
        <p className="text-xs text-muted mt-8">
          A confirmation has been sent to your email. Review typically takes
          1–2 business days.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="/portal/sign-in"
            className="bg-gold text-bg px-6 py-3 font-display font-bold text-xs tracking-wider uppercase rounded-full hover:bg-gold-hi"
          >
            Sign in to member portal →
          </a>
          <a
            href="/"
            className="text-xs text-muted hover:text-white underline"
          >
            Back to homepage
          </a>
        </div>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      onKeyDown={handleKeyDown}
      onSubmit={handleSubmit}
      className="space-y-5 pb-2 sm:pb-0"
    >
      <ol className="flex items-center gap-1.5 sm:gap-2" aria-label="Registration progress">
        {STEP_META.map(({ n, label }) => {
          const isCurrent = n === step;
          const isDone = n < step;
          return (
            <li key={n} className="flex-1 min-w-0">
              <div
                className={`flex items-center justify-center sm:justify-start gap-2 px-2 sm:px-3 py-2 rounded-full border text-[10px] sm:text-xs font-display uppercase tracking-wider ${
                  isCurrent
                    ? "border-gold bg-gold/10 text-gold"
                    : isDone
                      ? "border-emerald/60 bg-emerald/10 text-emerald"
                      : "border-border text-muted"
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] flex-shrink-0 ${
                    isCurrent
                      ? "bg-gold text-bg"
                      : isDone
                        ? "bg-emerald text-white"
                        : "bg-surface text-muted border border-border"
                  }`}
                  aria-hidden
                >
                  {isDone ? "✓" : n}
                </span>
                <span className="hidden sm:inline truncate">{label}</span>
              </div>
            </li>
          );
        })}
      </ol>

      {state.message && (
        <p
          className={`p-4 border text-sm ${
            state.ok
              ? "border-emerald text-white bg-emerald/20"
              : "border-red-500 text-red-200 bg-red-500/10"
          }`}
        >
          {state.message}
        </p>
      )}

      <div hidden={step !== 1} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field name="first_name" label="First name" required errors={state.errors?.first_name} />
          <Field name="last_name" label="Last name" required errors={state.errors?.last_name} />
        </div>
        <Field name="email" label="Email" type="email" required errors={state.errors?.email} />
        <Field
          name="password"
          label="Create a password"
          type="password"
          required
          minLength={10}
          hint="At least 10 characters."
          errors={state.errors?.password}
        />
      </div>

      <div hidden={step !== 2} className="space-y-4">
        <fieldset>
          <legend className="font-display text-xs tracking-wider text-gold uppercase mb-2">
            Gender <span className="text-red-400 ml-1">*</span>
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {GENDERS.map((g) => (
              <label
                key={g.id}
                className="flex items-center gap-3 px-4 py-3 border border-border has-[input:checked]:border-gold has-[input:checked]:bg-gold/10 cursor-pointer"
              >
                <input
                  type="radio"
                  name="gender"
                  value={g.id}
                  required
                  checked={gender === g.id}
                  onChange={(e) => setGender(e.target.value)}
                  className="accent-gold"
                />
                <span className="text-sm text-white">{g.name}</span>
              </label>
            ))}
          </div>
          {state.errors?.gender && (
            <p className="text-red-400 text-xs mt-1">
              {state.errors.gender.join(", ")}
            </p>
          )}
        </fieldset>

        <fieldset>
          <legend className="font-display text-xs tracking-wider text-gold uppercase mb-2">
            Pick your disciplines <span className="text-red-400 ml-1">*</span>
          </legend>
          <p className="text-xs text-muted mb-3">
            Tick every discipline you compete in. You&apos;ll declare a class and
            a W-L-D record for each one on the next step. One must be your primary.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {MARTIAL_ARTS.map((m) => {
              const checked = !!rows[m.id];
              const classes = classesForMartialArt(m.id);
              const classRequired = martialArtRequiresClass(m.id);
              return (
                <div
                  key={m.id}
                  className={`border rounded-lg p-3 ${checked ? "border-gold bg-gold/5" : "border-border"}`}
                >
                  <label className="flex flex-wrap items-center gap-x-3 gap-y-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleDiscipline(m.id, e.target.checked)}
                      className="accent-gold"
                    />
                    <span className="text-sm text-white font-display tracking-wider">
                      {m.name}
                    </span>
                    {checked && (
                      <label className="ml-auto flex items-center gap-1.5 text-[11px] text-gold">
                        <input
                          type="radio"
                          name="primary_discipline"
                          value={m.id}
                          checked={effectivePrimary === m.id}
                          onChange={() => setPrimary(m.id)}
                          className="accent-gold"
                        />
                        Primary
                      </label>
                    )}
                  </label>
                  {checked && classRequired && (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {classes.map((c) => (
                        <label
                          key={c.id}
                          className={`text-[11px] text-center px-2 py-1.5 rounded border cursor-pointer ${
                            rows[m.id]?.classCode === c.id
                              ? "border-gold bg-gold/10 text-gold"
                              : "border-border text-[#cfe3d8] hover:text-gold"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`class_${m.id}`}
                            value={c.id}
                            checked={rows[m.id]?.classCode === c.id}
                            onChange={() => updateRow(m.id, "classCode", c.id)}
                            className="sr-only"
                          />
                          {c.id.length === 1 ? c.id : c.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {state.errors?.disciplines && (
            <p className="text-red-400 text-xs mt-1">
              {state.errors.disciplines.join(", ")}
            </p>
          )}
        </fieldset>

        <label className="block">
          <span className="block font-display text-xs tracking-wider text-gold uppercase mb-1.5">
            Weight division <span className="text-red-400 ml-1">*</span>
            <span className="ml-2 text-[10px] text-muted normal-case tracking-normal">
              (based on your primary discipline)
            </span>
          </span>
          <select
            name="division"
            required
            disabled={!divisionReady}
            defaultValue=""
            key={`${gender}:${effectivePrimary}`}
            className="w-full px-4 py-3 bg-bg border border-border text-white focus:border-gold outline-none rounded-lg disabled:opacity-50"
          >
            <option value="" disabled>
              {divisionReady ? "Select a weight division…" : "Pick gender + primary first"}
            </option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {state.errors?.division && (
            <span className="text-red-400 text-xs mt-1 block">
              {state.errors.division.join(", ")}
            </span>
          )}
        </label>
      </div>

      <div hidden={step !== 3} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <DobField errors={state.errors?.date_of_birth} />
          <label className="block">
            <span className="block font-display text-xs tracking-wider text-gold uppercase mb-1.5">
              Country <span className="text-red-400 ml-1">*</span>
            </span>
            <input
              name="country"
              list="country-options"
              required
              autoComplete="country-name"
              defaultValue="Ireland"
              placeholder="Start typing a country…"
              className="w-full px-4 py-3 bg-bg border border-border text-white focus:border-gold outline-none rounded-lg"
            />
            <datalist id="country-options">
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.name} />
              ))}
            </datalist>
            {state.errors?.country && (
              <span className="text-red-400 text-xs mt-1 block">
                {state.errors.country.join(", ")}
              </span>
            )}
          </label>
        </div>

        <fieldset className="border border-border rounded-xl p-4 space-y-3">
          <legend className="font-display text-xs tracking-wider text-gold uppercase px-2">
            Gym <span className="text-red-400 ml-1">*</span>
          </legend>
          <p className="text-xs text-muted">
            Pick your gym from the list. If it&apos;s not there yet, choose
            &quot;My gym isn&apos;t listed&quot; and type the name — a W.U.C.O
            admin will follow up.
          </p>
          <label className="block">
            <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
              Your gym
            </span>
            <select
              name="gym_choice"
              value={gymChoice}
              onChange={(e) => setGymChoice(e.target.value)}
              className="w-full px-4 py-3 bg-bg border border-border text-white focus:border-gold outline-none rounded-lg"
            >
              <option value="">— pick your gym —</option>
              {gyms.map((g) => (
                <option key={g.id} value={String(g.id)}>
                  {g.name}
                  {g.city ? ` · ${g.city}` : ""}
                </option>
              ))}
              <option value="new">My gym isn&apos;t listed…</option>
            </select>
            {state.errors?.gym_choice && (
              <span className="text-red-400 text-xs mt-1 block">
                {state.errors.gym_choice.join(", ")}
              </span>
            )}
          </label>
          {gymChoice === "new" && (
            <label className="block">
              <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
                Gym name
              </span>
              <input
                name="gym_name_new"
                type="text"
                value={gymNameNew}
                onChange={(e) => setGymNameNew(e.target.value)}
                maxLength={200}
                placeholder="Where you train"
                className="w-full px-4 py-3 bg-bg border border-border text-white focus:border-gold outline-none rounded-lg"
              />
              <span className="text-xs text-muted mt-1 block">
                We&apos;ll share this with admin so they can onboard your club.
              </span>
              {state.errors?.gym_name_new && (
                <span className="text-red-400 text-xs mt-1 block">
                  {state.errors.gym_name_new.join(", ")}
                </span>
              )}
            </label>
          )}
          <Field
            name="coach_name"
            label="Coach name"
            required
            errors={state.errors?.coach_name}
            hint="Your head coach or primary instructor."
          />
        </fieldset>

        <fieldset className="border border-border rounded-xl p-4">
          <legend className="font-display text-xs tracking-wider text-gold uppercase px-2">
            Declare a fight record per discipline <span className="text-neutral-400">(optional)</span>
          </legend>
          <p className="text-xs text-muted mb-3">
            Share any prior competition record for each discipline you picked.
            Leave at 0 if you don&apos;t have one yet.
          </p>
          {selected.length === 0 ? (
            <p className="text-xs text-red-400">
              Go back to step 2 and pick at least one discipline first.
            </p>
          ) : (
            <div className="space-y-3">
              {selected.map((id) => {
                const label = MARTIAL_ARTS.find((m) => m.id === id)?.name ?? id;
                const r = rows[id];
                return (
                  <div key={id} className="border border-border/60 rounded-lg p-3">
                    <p className="font-display text-xs tracking-wider text-gold uppercase mb-2">
                      {label}
                      {effectivePrimary === id && (
                        <span className="ml-2 inline-block bg-gold text-bg text-[10px] px-2 py-0.5 rounded-full">
                          Primary
                        </span>
                      )}
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <RecordInput
                        label="Wins"
                        value={r.wins}
                        onChange={(v) => updateRow(id, "wins", v)}
                      />
                      <RecordInput
                        label="Losses"
                        value={r.losses}
                        onChange={(v) => updateRow(id, "losses", v)}
                      />
                      <RecordInput
                        label="Draws"
                        value={r.draws}
                        onChange={(v) => updateRow(id, "draws", v)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </fieldset>
        <input type="hidden" name="disciplines" value={disciplinesJson} />
      </div>

      <div hidden={step !== 4} className="space-y-4">
        <div className="rounded-xl border border-gold/40 p-4 md:p-5 bg-black/20">
          <p className="font-display text-xs md:text-sm tracking-wider text-gold uppercase mb-3">
            Review & agree
          </p>
          <p className="text-xs md:text-sm text-muted mb-4">
            Before submitting your fighter registration, please confirm the
            following. All three acknowledgements are required.
          </p>

          <label className="flex items-start gap-3 p-3 rounded-lg border border-border has-[input:checked]:border-gold has-[input:checked]:bg-gold/10 cursor-pointer mb-2">
            <input
              type="checkbox"
              name="accept_terms"
              required
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="accent-gold mt-0.5 flex-shrink-0"
            />
            <span className="text-xs md:text-sm text-white leading-relaxed">
              I have read and agree to the{" "}
              <a
                href="/terms/fighter-registration"
                target="_blank"
                rel="noreferrer noopener"
                className="text-gold underline hover:text-gold-hi"
              >
                Fighter Registration Terms &amp; Conditions
              </a>
              , including the account usage and banning policy.{" "}
              <span className="text-red-400">*</span>
            </span>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-lg border border-border has-[input:checked]:border-gold has-[input:checked]:bg-gold/10 cursor-pointer mb-2">
            <input
              type="checkbox"
              name="accept_privacy"
              required
              checked={acceptPrivacy}
              onChange={(e) => setAcceptPrivacy(e.target.checked)}
              className="accent-gold mt-0.5 flex-shrink-0"
            />
            <span className="text-xs md:text-sm text-white leading-relaxed">
              I acknowledge that I have read and understood the{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noreferrer noopener"
                className="text-gold underline hover:text-gold-hi"
              >
                WUCO Ireland Privacy Policy
              </a>
              . <span className="text-red-400">*</span>
            </span>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-lg border border-border has-[input:checked]:border-gold has-[input:checked]:bg-gold/10 cursor-pointer">
            <input
              type="checkbox"
              name="accept_accuracy"
              required
              checked={acceptAccuracy}
              onChange={(e) => setAcceptAccuracy(e.target.checked)}
              className="accent-gold mt-0.5 flex-shrink-0"
            />
            <span className="text-xs md:text-sm text-white leading-relaxed">
              I confirm that the information provided in my application is
              accurate and complete.{" "}
              <span className="text-red-400">*</span>
            </span>
          </label>

          {(state.errors?.accept_terms ||
            state.errors?.accept_privacy ||
            state.errors?.accept_accuracy) && (
            <p className="text-red-400 text-xs mt-3">
              You must agree to all three statements before submitting.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 pt-4">
        {stepError && (
          <p
            role="alert"
            className="order-0 sm:order-1 sm:flex-1 text-xs text-red-400 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2"
          >
            {stepError}
          </p>
        )}
        {step > 1 ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              goBack();
            }}
            style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
            className="order-2 sm:order-1 border border-border text-white px-5 py-3 font-display font-bold text-xs tracking-wider uppercase hover:border-gold rounded-full"
          >
            ← Back
          </button>
        ) : (
          <span className="hidden sm:block" />
        )}
        {step < 4 ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              goNext();
            }}
            style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
            className="order-1 sm:order-2 bg-emerald text-white px-7 py-3.5 font-display font-bold text-xs tracking-wider uppercase hover:bg-emerald-hi rounded-full"
          >
            Next →
          </button>
        ) : (
          <button
            type="submit"
            onClick={() => {
              submitIntent.current = true;
            }}
            disabled={pending || !allConsentsOk}
            title={!allConsentsOk ? "Tick all three acknowledgements to submit" : undefined}
            style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
            className="order-1 sm:order-2 bg-emerald text-white px-7 py-3.5 font-display font-bold text-xs tracking-wider uppercase hover:bg-emerald-hi disabled:opacity-50 rounded-full"
          >
            {pending ? "Submitting…" : "Create application →"}
          </button>
        )}
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
  hint,
  errors,
  defaultValue,
  min,
  max,
  minLength,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  hint?: string;
  errors?: string[];
  defaultValue?: string;
  min?: number;
  max?: number;
  minLength?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block font-display text-xs tracking-wider text-gold uppercase mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        min={min}
        max={max}
        minLength={minLength}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-bg border border-border text-white focus:border-gold outline-none rounded-lg"
      />
      {hint && <span className="text-xs text-muted mt-1 block">{hint}</span>}
      {errors && (
        <span className="text-red-400 text-xs mt-1 block">{errors.join(", ")}</span>
      )}
    </label>
  );
}

function RecordInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  // Local string so a leading 0 clears cleanly on focus/typing.
  const [text, setText] = React.useState<string>(value > 0 ? String(value) : "");
  React.useEffect(() => {
    setText(value > 0 ? String(value) : "");
  }, [value]);
  return (
    <label className="block">
      <span className="block font-display text-xs tracking-wider text-gold uppercase mb-1.5">
        {label}
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={999}
        value={text}
        placeholder="0"
        onFocus={(e) => {
          if (text === "0") {
            setText("");
            onChange(0);
          }
          e.currentTarget.select();
        }}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            setText("");
            onChange(0);
            return;
          }
          const n = Number(raw);
          if (!Number.isFinite(n) || n < 0) return;
          setText(raw);
          onChange(Math.floor(n));
        }}
        onBlur={() => {
          if (text === "") setText("");
        }}
        className="w-full px-4 py-3 bg-bg border border-border text-white focus:border-gold outline-none rounded-lg"
      />
    </label>
  );
}

function DobField({ errors }: { errors?: string[] }) {
  const [day, setDay] = React.useState("");
  const [month, setMonth] = React.useState("");
  const [year, setYear] = React.useState("");

  const value =
    day && month && year
      ? `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
      : "";

  const now = new Date();
  const thisYear = now.getFullYear();
  const years: number[] = [];
  for (let y = thisYear; y >= thisYear - 100; y--) years.push(y);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const daysInMonth = (() => {
    const m = Number(month);
    const y = Number(year);
    if (!m || !y) return 31;
    return new Date(y, m, 0).getDate();
  })();

  const selectClass =
    "w-full px-3 py-3 bg-bg border border-border text-white focus:border-gold outline-none rounded-lg";

  return (
    <div className="block">
      <span className="block font-display text-xs tracking-wider text-gold uppercase mb-1.5">
        Date of birth
      </span>
      <div className="grid grid-cols-[1fr_1.4fr_1fr] gap-2">
        <select
          value={day}
          onChange={(e) => setDay(e.target.value)}
          aria-label="Day"
          className={selectClass}
        >
          <option value="">Day</option>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
            <option key={d} value={String(d)}>{d}</option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          aria-label="Month"
          className={selectClass}
        >
          <option value="">Month</option>
          {months.map((m, i) => (
            <option key={m} value={String(i + 1)}>{m}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          aria-label="Year"
          className={selectClass}
        >
          <option value="">Year</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
      </div>
      <input type="hidden" name="date_of_birth" value={value} />
      <span className="text-xs text-muted mt-1 block">
        Used to confirm J-Class eligibility.
      </span>
      {errors && (
        <span className="text-red-400 text-xs mt-1 block">{errors.join(", ")}</span>
      )}
    </div>
  );
}

function StatusStep({
  n,
  label,
  done,
}: {
  n: number;
  label: string;
  done?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
        done
          ? "border-emerald/60 bg-emerald/10"
          : "border-gold/30 bg-black/20"
      }`}
    >
      <span
        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-display ${
          done ? "bg-emerald text-white" : "bg-gold/20 text-gold border border-gold/40"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <span
        className={`font-display text-xs tracking-wider uppercase ${
          done ? "text-emerald-300" : "text-gold"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
