"use client";

import * as React from "react";
import { GENDERS, ALL_DIVISIONS, divisionsFor } from "@/lib/divisions";
import { scheduleBoutFromAdmin } from "@/app/actions/event-flow";

export type FighterPickOption = {
  id: number;
  name: string;
  gender: string;
  division: string;
  martialArt: string;
  wins: number;
  losses: number;
  draws: number;
};

// Admin picks gender → division → red/blue; red/blue lists filter to the
// cohort. Creates paired offer rows (status=offered) so both fighters must
// accept before the bout can be published onto the fight card.
export function AdminAddBoutForm({
  eventId,
  nextOrder,
  fighters,
}: {
  eventId: number;
  nextOrder: number;
  fighters: FighterPickOption[];
}) {
  const [gender, setGender] = React.useState<string>("");
  const [division, setDivision] = React.useState<string>("");
  const [redId, setRedId] = React.useState<string>("");
  const [blueId, setBlueId] = React.useState<string>("");

  // Division list follows the chosen gender. MMA divisions are gender-neutral.
  const divisions = React.useMemo(() => {
    if (!gender) return [];
    // Combine both discipline families this fighter could land in; keep the
    // gendered subset only.
    const men = divisionsFor("male", null);
    const women = divisionsFor("female", null);
    const mma = ALL_DIVISIONS.filter((d) => d.id.startsWith("MMA-"));
    if (gender === "male") return [...men, ...mma];
    if (gender === "female") return [...women, ...mma];
    return [];
  }, [gender]);

  // Reset division when gender changes; reset corners when either changes.
  React.useEffect(() => {
    setDivision("");
  }, [gender]);
  React.useEffect(() => {
    setRedId("");
    setBlueId("");
  }, [gender, division]);

  const eligible = React.useMemo(() => {
    if (!gender || !division) return [] as FighterPickOption[];
    return fighters.filter(
      (f) =>
        (f.gender === gender || f.division.startsWith("MMA-")) &&
        f.division === division,
    );
  }, [fighters, gender, division]);

  const redOptions = eligible;
  const blueOptions = eligible.filter((f) => String(f.id) !== redId);

  const canSubmit = !!redId && !!blueId && redId !== blueId;

  return (
    <form action={scheduleBoutFromAdmin} className="p-4 space-y-3">
      <input type="hidden" name="event_id" value={eventId} />
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
            Gender
          </span>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full px-3 py-2 bg-bg border border-border text-white text-sm"
            required
          >
            <option value="">— pick —</option>
            {GENDERS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
            Division
          </span>
          <select
            name="division"
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            disabled={!gender}
            required
            className="w-full px-3 py-2 bg-bg border border-border text-white text-sm disabled:opacity-50"
          >
            <option value="">
              {gender ? "— pick division —" : "Pick gender first"}
            </option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
            Red corner
          </span>
          <select
            name="red_id"
            required
            value={redId}
            onChange={(e) => setRedId(e.target.value)}
            disabled={!division}
            className="w-full px-3 py-2 bg-bg border border-border text-white text-sm disabled:opacity-50"
          >
            <option value="">
              {!division
                ? "Pick a division first"
                : redOptions.length === 0
                  ? "No eligible fighters"
                  : "— pick fighter —"}
            </option>
            {redOptions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.wins}-{f.losses}-{f.draws})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
            Blue corner
          </span>
          <select
            name="blue_id"
            required
            value={blueId}
            onChange={(e) => setBlueId(e.target.value)}
            disabled={!redId}
            className="w-full px-3 py-2 bg-bg border border-border text-white text-sm disabled:opacity-50"
          >
            <option value="">
              {!redId
                ? "Pick red corner first"
                : blueOptions.length === 0
                  ? "No other eligible fighters"
                  : "— pick fighter —"}
            </option>
            {blueOptions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.wins}-{f.losses}-{f.draws})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
            Order
          </span>
          <input
            type="number"
            name="bout_order"
            min={1}
            max={99}
            defaultValue={nextOrder}
            className="w-full px-3 py-2 bg-bg border border-border text-white text-sm"
          />
        </label>
        <label className="block">
          <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
            Card section
          </span>
          <select
            name="card_section"
            defaultValue="Main"
            className="w-full px-3 py-2 bg-bg border border-border text-white text-sm"
          >
            <option>Main</option>
            <option>Co-Main</option>
            <option>Prelim</option>
          </select>
        </label>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="bg-emerald text-white px-4 py-2 text-xs font-display tracking-wider hover:bg-emerald-hi disabled:opacity-50"
      >
        OFFER BOUT →
      </button>
      <p className="text-[11px] text-muted">
        Both fighters receive an offer. The bout only joins the fight card after
        both accept — admin then publishes it.
      </p>
    </form>
  );
}
