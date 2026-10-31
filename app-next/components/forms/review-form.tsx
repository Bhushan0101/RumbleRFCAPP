"use client";

import * as React from "react";
import { useActionState } from "react";
import { reviewFighter, type ReviewState } from "@/app/actions/admin";

const initial: ReviewState = { ok: false, message: "" };

type Props = {
  athleteId: number;
  currentStatus: string;
};

export function ReviewForm({ athleteId, currentStatus }: Props) {
  const [state, action, pending] = useActionState(reviewFighter, initial);
  const options =
    currentStatus === "approved"
      ? [["suspended", "Suspend profile"]]
      : [
          ["approved", "Approve fighter"],
          ["rejected", "Decline application"],
        ];
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="athlete_id" value={athleteId} />
      <select
        name="decision"
        required
        defaultValue={options[0][0]}
        className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-white"
      >
        {options.map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
      <textarea
        name="note"
        rows={2}
        maxLength={2000}
        placeholder="Required for a decline or suspension."
        className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-white text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="bg-gold text-bg px-4 py-2 font-display text-xs tracking-wider rounded-full hover:bg-gold-hi disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save decision →"}
      </button>
      {state.message && (
        <p
          className={`text-xs mt-2 px-3 py-2 rounded-lg border ${
            state.ok
              ? "border-emerald/40 bg-emerald/10 text-emerald-200"
              : "border-red-500/60 bg-red-500/10 text-red-200"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
