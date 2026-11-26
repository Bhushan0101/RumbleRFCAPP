"use client";

import * as React from "react";
import { useActionState } from "react";
import { registerClubInterest, type EventFlowState } from "@/app/actions/event-flow";

const initial: EventFlowState = { ok: false, message: "" };

export type ClubMemberOption = { id: number; name: string };
export type ClubEventOption = { id: number; title: string; startsAt: string | null };

export function ClubEventInterestForm({
  members,
  events,
}: {
  members: ClubMemberOption[];
  events: ClubEventOption[];
}) {
  const [state, action, pending] = useActionState(registerClubInterest, initial);

  if (members.length === 0 || events.length === 0) {
    return (
      <p className="text-xs text-muted">
        {members.length === 0
          ? "Once you have approved fighters at this club, you can raise interest in events on their behalf."
          : "No upcoming events to register interest for."}
      </p>
    );
  }

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
      <label className="block">
        <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
          Fighter
        </span>
        <select
          name="athlete_id"
          required
          defaultValue=""
          className="w-full px-3 py-2 bg-bg border border-border text-white text-sm rounded"
        >
          <option value="" disabled>— pick fighter —</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
          Event
        </span>
        <select
          name="event_id"
          required
          defaultValue=""
          className="w-full px-3 py-2 bg-bg border border-border text-white text-sm rounded"
        >
          <option value="" disabled>— pick event —</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
              {e.startsAt ? ` · ${e.startsAt}` : ""}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="bg-emerald text-white px-4 py-2 text-xs font-display tracking-wider hover:bg-emerald-hi rounded disabled:opacity-60 self-end"
      >
        {pending ? "Sending…" : "RAISE INTEREST →"}
      </button>
      {state.message && (
        <p
          className={`sm:col-span-3 text-xs ${
            state.ok ? "text-emerald-300" : "text-red-300"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
