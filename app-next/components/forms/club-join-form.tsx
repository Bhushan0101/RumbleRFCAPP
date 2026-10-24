"use client";

import * as React from "react";
import { useActionState } from "react";
import { submitGymEnquiry, type FormState } from "@/app/actions/public";

const initial: FormState = { ok: false, message: "" };

export function ClubJoinForm() {
  const [state, action, pending] = useActionState(submitGymEnquiry, initial);
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
      <Field name="gym_name" label="Gym name" required errors={state.errors?.gym_name} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="contact_name" label="Contact name" required errors={state.errors?.contact_name} />
        <Field name="contact_email" label="Email" type="email" required errors={state.errors?.contact_email} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="phone" label="Phone" errors={state.errors?.phone} />
        <Field name="city" label="City" errors={state.errors?.city} />
      </div>
      <Field name="message" label="Anything we should know?" textarea errors={state.errors?.message} />
      <button
        type="submit"
        disabled={pending}
        className="bg-gold text-bg px-7 py-3.5 font-display font-bold text-xs tracking-wider uppercase hover:bg-gold-hi disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send enquiry →"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
  textarea,
  errors,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
  errors?: string[];
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
        type={type}
        required={required}
        className="w-full px-4 py-3 bg-bg border border-border text-white focus:border-gold outline-none"
        {...(textarea && { rows: 4 })}
      />
      {errors && (
        <span className="text-red-400 text-xs mt-1 block">{errors.join(", ")}</span>
      )}
    </label>
  );
}
