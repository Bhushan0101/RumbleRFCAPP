"use client";

import * as React from "react";
import { useActionState } from "react";
import { inviteFighterToClub } from "@/app/actions/club";
import type { ClubFlowState } from "@/app/actions/club";

const initial: ClubFlowState = { ok: false, message: "" };

export type FighterSearchOption = {
  id: number;
  name: string;
  fighterNo: string | null;
  division: string;
  martialArt: string;
  gymName: string | null;
};

export function ClubInviteFighterForm({
  fighters,
}: {
  fighters: FighterSearchOption[];
}) {
  const [state, action, pending] = useActionState(inviteFighterToClub, initial);
  const [query, setQuery] = React.useState<string>("");
  const [picked, setPicked] = React.useState<FighterSearchOption | null>(null);

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as FighterSearchOption[];
    return fighters
      .filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          (f.fighterNo ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [fighters, query]);

  // Reset on successful submit so a second invite can be composed.
  React.useEffect(() => {
    if (state.ok) {
      setQuery("");
      setPicked(null);
    }
  }, [state.ok]);

  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
          Search fighters
        </span>
        <input
          type="text"
          value={picked ? `${picked.name}${picked.fighterNo ? ` · ${picked.fighterNo}` : ""}` : query}
          onChange={(e) => {
            setPicked(null);
            setQuery(e.target.value);
          }}
          placeholder="Type a name or fighter number"
          className="w-full px-3 py-2 bg-bg border border-border text-white text-sm rounded"
        />
      </label>
      {!picked && matches.length > 0 && (
        <ul className="border border-border rounded bg-bg divide-y divide-border/60">
          {matches.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setPicked(m)}
                className="w-full text-left px-3 py-2 hover:bg-gold/10 text-sm text-white"
              >
                <span className="font-display tracking-wider">{m.name}</span>
                <span className="block text-[11px] text-muted">
                  {m.fighterNo ?? "—"} · {m.gymName ?? "unaffiliated"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {picked && (
        <>
          <input type="hidden" name="athlete_id" value={picked.id} />
          <label className="block">
            <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
              Note to the fighter (optional)
            </span>
            <textarea
              name="note"
              rows={2}
              maxLength={1000}
              placeholder={`Why they'd be a great fit at ${picked.name}'s next club…`}
              className="w-full px-3 py-2 bg-bg border border-border text-white text-sm rounded"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="bg-emerald text-white px-4 py-2 text-xs font-display tracking-wider hover:bg-emerald-hi rounded disabled:opacity-60"
          >
            {pending ? "Sending…" : `SEND INVITE TO ${picked.name.toUpperCase()}`}
          </button>
        </>
      )}
      {state.message && (
        <p
          className={`text-xs ${state.ok ? "text-emerald-300" : "text-red-300"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
