"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  requestClubJoin,
  type ClubFlowState,
} from "@/app/actions/club";

const initial: ClubFlowState = { ok: false, message: "" };

type JoinStatus = "none" | "pending" | "approved" | "rejected" | "already_at";

export function JoinClubBlock({
  gymId,
  gymName,
  status,
}: {
  gymId: number;
  gymName: string;
  status: JoinStatus;
}) {
  const [state, action, pending] = useActionState(requestClubJoin, initial);

  if (status === "already_at") {
    return (
      <div className="rounded-2xl border border-emerald/60 bg-emerald/10 p-4 md:p-5">
        <p className="font-display text-xs tracking-widest text-emerald uppercase mb-1">
          You&apos;re at this club
        </p>
        <p className="text-sm text-white">
          {gymName} is your registered club on W.U.C.O.
        </p>
      </div>
    );
  }
  if (status === "pending") {
    return (
      <div className="rounded-2xl border border-gold/40 bg-gold/5 p-4 md:p-5">
        <p className="font-display text-xs tracking-widest text-gold uppercase mb-1">
          Request pending
        </p>
        <p className="text-sm text-white">
          A W.U.C.O admin at {gymName} has your join request — you&apos;ll get
          an email once reviewed.
        </p>
      </div>
    );
  }
  if (status === "approved") {
    return (
      <div className="rounded-2xl border border-emerald/60 bg-emerald/10 p-4 md:p-5">
        <p className="font-display text-xs tracking-widest text-emerald uppercase mb-1">
          Approved
        </p>
        <p className="text-sm text-white">
          Welcome to {gymName}. Your profile has been linked to the club.
        </p>
      </div>
    );
  }

  // status === "none" | "rejected" → show the request form
  return (
    <form
      action={action}
      className="rounded-2xl border border-gold/40 bg-gold/5 p-4 md:p-5"
    >
      <input type="hidden" name="gym_id" value={gymId} />
      <p className="font-display text-sm text-white tracking-wider mb-1">
        Want to train and compete under {gymName}?
      </p>
      <p className="text-xs text-muted mb-3">
        Send a join request — the club admin will review and respond. Once
        approved your fighter profile will be linked to this club.
      </p>
      <label className="block mb-3">
        <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
          Message to the club (optional)
        </span>
        <textarea
          name="message"
          rows={2}
          maxLength={1000}
          className="w-full px-3 py-2 bg-bg border border-border text-white text-xs rounded"
          placeholder="E.g. been training here for 6 months with Coach Joshua."
        />
      </label>
      {state.message && (
        <p
          className={`text-xs mb-2 ${state.ok ? "text-emerald-300" : "text-red-300"}`}
        >
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || state.ok}
        className="inline-block bg-gold text-bg px-5 py-2.5 font-display font-bold text-xs tracking-wider uppercase rounded-full hover:bg-gold-hi disabled:opacity-60"
      >
        {pending
          ? "Sending…"
          : state.ok
            ? "Request sent"
            : status === "rejected"
              ? "Request again"
              : "Request to join this club"}
      </button>
    </form>
  );
}
