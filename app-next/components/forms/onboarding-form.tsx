"use client";

import { useActionState } from "react";
import { submitOnboarding } from "@/app/actions/onboarding";
import type { FormState } from "@/app/actions/public";

const initial: FormState = { ok: false, message: "" };

export function OnboardingForm({
  token,
  gymName,
  city,
}: {
  token: string;
  gymName: string;
  city: string;
}) {
  const [state, action, pending] = useActionState(submitOnboarding, initial);
  return (
    <form action={action} className="space-y-4 max-w-2xl bg-surface border border-border p-6 md:p-8">
      {state.message && (
        <p
          className={`p-3 border text-sm ${
            state.ok
              ? "border-emerald bg-emerald/15 text-white"
              : "border-red-500 bg-red-500/10 text-red-200"
          }`}
        >
          {state.message}
        </p>
      )}
      <input type="hidden" name="token" value={token} />
      <Field name="name" label="Gym name" defaultValue={gymName} required />
      <Field name="city" label="City" defaultValue={city} />
      <Field
        name="revolut_handle"
        label="Revolut handle or URL"
        placeholder="revolut.me/yourgym"
      />
      <Field name="about" label="About your gym" textarea />
      <button
        disabled={pending}
        className="bg-gold text-bg px-7 py-3.5 font-display font-bold text-xs tracking-wider uppercase hover:bg-gold-hi disabled:opacity-50"
      >
        {pending ? "Saving…" : "Submit onboarding →"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue = "",
  placeholder,
  required,
  textarea,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  textarea?: boolean;
}) {
  const Tag = textarea ? "textarea" : "input";
  return (
    <label className="block">
      <span className="block font-display text-xs tracking-wider text-gold uppercase mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </span>
      <Tag
        name={name}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-bg border border-border text-white focus:border-gold outline-none"
        {...(textarea && { rows: 4 })}
      />
    </label>
  );
}
