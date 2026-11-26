"use client";

import * as React from "react";
import { offerBout } from "@/app/actions/event-flow";
import { ALL_DIVISIONS } from "@/lib/divisions";
import { martialArtName } from "@/lib/martial-arts";

export type OpponentOption = {
  id: number;
  name: string;
  division: string;
  martialArt: string;
  wins: number;
  losses: number;
  draws: number;
};

export function AdminOfferBoutForm({
  eventId,
  athleteId,
  athleteDivision,
  athleteMartialArt,
  opponents,
}: {
  eventId: number;
  athleteId: number;
  /** Defaults the division select to the interested fighter's own division. */
  athleteDivision: string;
  /** Used to narrow opponents to the same primary discipline. */
  athleteMartialArt: string;
  /** Approved athletes (minus the interested one), pre-loaded. */
  opponents: OpponentOption[];
}) {
  const [division, setDivision] = React.useState<string>(athleteDivision || "");
  const [opponentId, setOpponentId] = React.useState<string>("");

  // Filter to the chosen division + the interested fighter's primary art so
  // we don't propose cross-discipline matchups.
  const filteredOpponents = React.useMemo(() => {
    return opponents.filter(
      (o) =>
        (!division || o.division === division) &&
        (!athleteMartialArt || o.martialArt === athleteMartialArt),
    );
  }, [opponents, division, athleteMartialArt]);

  // Clear opponent when the division changes so we never submit a mismatch.
  React.useEffect(() => {
    setOpponentId("");
  }, [division]);

  return (
    <form action={offerBout} className="p-3 space-y-2">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="athlete_id" value={athleteId} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block">
          <span className="font-display text-[9px] tracking-wider text-gold uppercase block mb-0.5">
            Division
          </span>
          <select
            name="offer_division"
            required
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            className="w-full px-2 py-1.5 bg-bg border border-border text-white text-xs rounded"
          >
            <option value="">— pick division —</option>
            {ALL_DIVISIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-display text-[9px] tracking-wider text-gold uppercase block mb-0.5">
            Opponent
            {athleteMartialArt && (
              <span className="ml-1 normal-case tracking-normal text-muted">
                ({martialArtName(athleteMartialArt)})
              </span>
            )}
          </span>
          <select
            name="opponent_id"
            required
            value={opponentId}
            onChange={(e) => setOpponentId(e.target.value)}
            disabled={!division}
            className="w-full px-2 py-1.5 bg-bg border border-border text-white text-xs rounded disabled:opacity-50"
          >
            <option value="">
              {!division
                ? "Pick a division first"
                : filteredOpponents.length === 0
                  ? "No eligible fighters in this division"
                  : "— pick opponent —"}
            </option>
            {filteredOpponents.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.wins}-{o.losses}-{o.draws})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-display text-[9px] tracking-wider text-gold uppercase block mb-0.5">
            Card section
          </span>
          <input
            name="offer_section"
            type="text"
            placeholder="Main / Co-Main / Prelim"
            className="w-full px-2 py-1.5 bg-bg border border-border text-white text-xs rounded"
          />
        </label>
        <label className="block">
          <span className="font-display text-[9px] tracking-wider text-gold uppercase block mb-0.5">
            Note
          </span>
          <input
            name="offer_note"
            type="text"
            className="w-full px-2 py-1.5 bg-bg border border-border text-white text-xs rounded"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={!division || !opponentId}
        className="bg-gold text-bg px-3 py-1.5 text-xs font-display tracking-wider hover:bg-gold-hi rounded disabled:opacity-50"
      >
        SEND OFFER →
      </button>
      <p className="text-[10px] text-muted">
        The bout only goes on the card once BOTH fighters accept.
      </p>
    </form>
  );
}
