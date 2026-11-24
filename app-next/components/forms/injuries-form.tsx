"use client";

import * as React from "react";
import { useActionState } from "react";
import { updateInjuries, type ProfileState } from "@/app/actions/profile";

const initial: ProfileState = { ok: false, message: "" };

export function InjuriesForm({
  initialHasInjuries,
  initialDetails,
}: {
  initialHasInjuries: boolean;
  initialDetails: string;
}) {
  const [state, action, pending] = useActionState(updateInjuries, initial);
  const [has, setHas] = React.useState<"yes" | "no">(initialHasInjuries ? "yes" : "no");

  return (
    <form action={action} className="space-y-4">
      <fieldset>
        <legend className="text-xs text-gold tracking-wider uppercase mb-2">
          Any current injuries?
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {(["yes", "no"] as const).map((v) => (
            <label
              key={v}
              className="flex items-center gap-2 px-4 py-3 border border-border rounded-lg has-[input:checked]:border-gold has-[input:checked]:bg-gold/10 cursor-pointer"
            >
              <input
                type="radio"
                name="has_injuries"
                value={v}
                checked={has === v}
                onChange={() => setHas(v)}
                className="accent-gold"
              />
              <span className="text-sm text-white uppercase tracking-wider">{v}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {has === "yes" && (
        <label className="block">
          <span className="text-xs text-gold tracking-wider uppercase mb-1.5 block">
            Details
          </span>
          <textarea
            name="injuries_details"
            rows={4}
            required
            defaultValue={initialDetails}
            maxLength={4000}
            placeholder="E.g. recovering from a left ACL repair; cleared for sparring but not competition."
            className="w-full px-4 py-3 bg-bg border border-border text-white rounded-lg focus:border-gold outline-none"
          />
        </label>
      )}
      {state.message && (
        <p className={`text-xs ${state.ok ? "text-emerald-300" : "text-red-400"}`}>
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-emerald text-white px-5 py-2.5 font-display text-xs tracking-wider rounded-full disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
