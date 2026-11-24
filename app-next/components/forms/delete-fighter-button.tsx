"use client";

import * as React from "react";
import { deleteFighter } from "@/app/actions/admin";

export function DeleteFighterButton({
  athleteId,
  fighterName,
}: {
  athleteId: number;
  fighterName: string;
}) {
  const [pending, startTransition] = React.useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const ok = window.confirm(
      `Permanently delete ${fighterName}?\n\nThis removes the athlete, their profile, passport, rankings, bouts, event registrations and the linked login. This cannot be undone.`,
    );
    if (!ok) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    const data = new FormData();
    data.set("athlete_id", String(athleteId));
    startTransition(async () => {
      await deleteFighter(data);
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <h4 className="font-display text-xs tracking-wider text-red-400 uppercase mb-2">
        Danger zone
      </h4>
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-red-500/10 border border-red-500/60 text-red-200 px-4 py-2 font-display text-xs tracking-wider rounded-full hover:bg-red-500/20 disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete fighter permanently"}
      </button>
    </form>
  );
}
