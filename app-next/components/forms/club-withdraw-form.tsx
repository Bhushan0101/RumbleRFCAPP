"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  requestClubClosure,
  type ClubFlowState,
} from "@/app/actions/club";

const initial: ClubFlowState = { ok: false, message: "" };

export function ClubWithdrawForm({
  pendingAlready,
}: {
  pendingAlready: boolean;
}) {
  const [state, action, pending] = useActionState(requestClubClosure, initial);
  const [confirming, setConfirming] = React.useState(false);

  if (pendingAlready || state.ok) {
    return (
      <div className="border border-orange-500/60 bg-orange-500/10 text-orange-200 rounded-lg p-4 text-sm">
        {state.message ||
          "A withdrawal request is pending with the W.U.C.O admin team. They'll be in touch."}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="font-display text-[10px] tracking-wider text-red-200 uppercase block mb-1">
          Reason (optional — shared with the admin team)
        </span>
        <textarea
          name="reason"
          rows={3}
          maxLength={2000}
          placeholder="e.g. Closing the gym at end of year, moving to a different federation, etc."
          className="w-full px-3 py-2.5 bg-bg border border-border text-white text-sm rounded focus:border-red-400 outline-none"
        />
      </label>
      {state.message && !state.ok && (
        <p className="text-xs text-red-300">{state.message}</p>
      )}
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="border border-red-500 text-red-200 px-4 py-2 font-display text-xs tracking-wider hover:bg-red-500 hover:text-white rounded"
        >
          Request withdrawal from W.U.C.O
        </button>
      ) : (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-red-200">
            Confirm? This notifies admin — your club stays active until processed.
          </span>
          <button
            type="submit"
            disabled={pending}
            className="bg-red-500 text-white px-4 py-2 font-display text-xs tracking-wider hover:bg-red-600 rounded disabled:opacity-60"
          >
            {pending ? "Sending…" : "Yes, send withdrawal request"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-xs text-muted hover:text-white underline"
          >
            Cancel
          </button>
        </div>
      )}
    </form>
  );
}
