"use client";

import * as React from "react";
import { useActionState } from "react";
import { registerFighter, type FormState } from "@/app/actions/public";

const initial: FormState = { ok: false, message: "" };

const CLASSES = [
  { id: "J", name: "J-Class (Under 18)" },
  { id: "N", name: "N-Class (≤5 fights)" },
  { id: "L", name: "L-Class (Learning class)" },
  { id: "C", name: "C-Class (No shin pads)" },
  { id: "B", name: "B-Class (Debut pro)" },
  { id: "A", name: "A-Class (Seasoned pro)" },
];

export function FighterRegisterForm() {
  const [state, action, pending] = useActionState(registerFighter, initial);
  return (
    <form action={action} className="space-y-4">
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
        hint="At least 10 characters."
        errors={state.errors?.password}
      />
      <Field
        name="martial_art"
        label="Martial art"
        required
        hint="For example: K-1, Kickboxing, MMA, Muay Thai, Brazilian Jiu Jitsu."
        errors={state.errors?.martial_art}
      />
      <fieldset>
        <legend className="font-display text-xs tracking-wider text-gold uppercase mb-2">
          Choose your class <span className="text-red-400 ml-1">*</span>
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CLASSES.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-3 px-4 py-3 border border-border has-[input:checked]:border-gold has-[input:checked]:bg-gold/10 cursor-pointer"
            >
              <input
                type="radio"
                name="class_code"
                value={c.id}
                required
                className="accent-gold"
              />
              <span className="text-sm text-white">{c.name}</span>
            </label>
          ))}
        </div>
        {state.errors?.class_code && (
          <p className="text-red-400 text-xs mt-1">
            {state.errors.class_code.join(", ")}
          </p>
        )}
      </fieldset>
      <Field name="country" label="Country" required errors={state.errors?.country} />

      <fieldset className="border border-border rounded-xl p-4">
        <legend className="font-display text-xs tracking-wider text-gold uppercase px-2">
          Declare your fight record <span className="text-neutral-400">(optional)</span>
        </legend>
        <p className="text-xs text-muted mb-3">
          Share any prior competition record you'd like the W.U.C.O admin to verify.
          Leave at 0 if you don't have one yet.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <Field name="wins" label="Wins" type="number" min={0} max={999} defaultValue="0" />
          <Field name="losses" label="Losses" type="number" min={0} max={999} defaultValue="0" />
          <Field name="draws" label="Draws" type="number" min={0} max={999} defaultValue="0" />
        </div>
        <label className="block mt-3">
          <span className="font-display text-xs tracking-wider text-gold uppercase mb-1.5 block">
            Record notes <span className="text-neutral-400">(optional)</span>
          </span>
          <textarea
            name="record_note"
            maxLength={2000}
            rows={3}
            placeholder="Promotions you've fought on, titles, dates, references — anything that helps verification."
            className="w-full px-4 py-3 bg-bg border border-border text-white focus:border-gold outline-none rounded-lg"
          />
        </label>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="bg-emerald text-white px-7 py-3.5 font-display font-bold text-xs tracking-wider uppercase hover:bg-emerald-hi disabled:opacity-50 rounded-full"
      >
        {pending ? "Submitting…" : "Create fighter application →"}
      </button>
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
        className="w-full px-4 py-3 bg-bg border border-border text-white focus:border-gold outline-none rounded-lg"
      />
      {hint && <span className="text-xs text-muted mt-1 block">{hint}</span>}
      {errors && (
        <span className="text-red-400 text-xs mt-1 block">{errors.join(", ")}</span>
      )}
    </label>
  );
}
