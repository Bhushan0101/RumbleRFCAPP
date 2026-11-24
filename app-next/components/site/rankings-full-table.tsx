"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { MARTIAL_ARTS } from "@/lib/martial-arts";
import { divisionDisplayName } from "@/lib/divisions";
import { RankMedal } from "@/components/ui/rank-medal";

export type RankingsFullRow = {
  id: number;
  position: number;
  division: string;
  athleteId: number;
  name: string;
  wins: number;
  losses: number;
  draws: number;
  fighterNo: string | null;
  disciplines: string[];
};

const DISCIPLINE_FILTERS: Array<{ id: string; label: string }> = [
  { id: "all", label: "All" },
  ...MARTIAL_ARTS.map((m) => ({ id: m.id, label: m.name })),
];

const PUBLIC_LIMIT = 5;

export function RankingsFullTable({
  rows,
  signedIn,
}: {
  rows: RankingsFullRow[];
  signedIn: boolean;
}) {
  const [discipline, setDiscipline] = React.useState<string>("all");

  const visibleRows =
    discipline === "all"
      ? rows
      : rows.filter((r) => r.disciplines.includes(discipline));

  const divisions = Array.from(new Set(visibleRows.map((r) => r.division)));

  return (
    <>
      {!signedIn && (
        <div
          className="mb-6 rounded-xl border-2 border-gold/60 p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-5"
          style={{ background: "linear-gradient(90deg, rgba(200,164,90,0.08), rgba(11,61,46,0.4))" }}
        >
          <div className="text-center md:text-left">
            <p className="font-display text-sm md:text-base text-white tracking-wider">
              Viewing top {PUBLIC_LIMIT} per division.
            </p>
            <p className="text-xs md:text-sm text-muted mt-1">
              Sign in or register as a W.U.C.O fighter to see every ranked athlete.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link
              href="/portal/sign-in"
              className="inline-block bg-gold text-bg px-5 py-2.5 font-display font-bold text-[11px] tracking-wider uppercase rounded-full hover:bg-gold-hi whitespace-nowrap"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-block border border-gold text-white px-5 py-2.5 font-display font-bold text-[11px] tracking-wider uppercase rounded-full hover:bg-gold hover:text-bg whitespace-nowrap"
            >
              Register
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-[10px] font-display tracking-wider text-gold uppercase mr-2">
          Discipline
        </span>
        {DISCIPLINE_FILTERS.map((d) => (
          <button
            key={d.id}
            onClick={() => setDiscipline(d.id)}
            className={cn(
              "px-3 py-1 font-display font-bold text-[11px] tracking-wider rounded-full border",
              discipline === d.id
                ? "bg-emerald text-white border-emerald"
                : "bg-transparent text-[#cfe3d8] border-border hover:text-gold",
            )}
          >
            {d.label.toUpperCase()}
          </button>
        ))}
      </div>

      {divisions.length === 0 ? (
        <p className="text-sm text-muted text-center py-10 border border-dashed border-border rounded-xl">
          No ranked fighters in this discipline yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {divisions.map((d) => {
            const list = visibleRows
              .filter((r) => r.division === d)
              .sort((a, b) => a.position - b.position);
            const shown = signedIn ? list : list.slice(0, PUBLIC_LIMIT);
            const hiddenCount = signedIn ? 0 : Math.max(0, list.length - PUBLIC_LIMIT);
            return (
              <div
                key={d}
                className="bg-surface border border-border rounded-2xl p-5 overflow-hidden"
              >
                <h2 className="font-display text-xl tracking-wider text-white mb-3 pb-3 border-b border-border">
                  {divisionDisplayName(null, d)}
                </h2>
                <ol className="divide-y divide-border/50">
                  {shown.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/fighters/${r.athleteId}`}
                        className={`flex items-center gap-4 py-3 px-2 rounded-xl transition-colors ${
                          r.position <= 3
                            ? "hover:bg-gold/5"
                            : "hover:bg-surface-3"
                        }`}
                      >
                        <RankMedal position={r.position} size="md" />
                        <span className="flex-1 min-w-0">
                          <span className="text-white block font-display tracking-wider">
                            {r.name}
                          </span>
                          <span className="text-xs text-muted">
                            {r.wins}–{r.losses}–{r.draws}
                            {r.fighterNo && <> · {r.fighterNo}</>}
                          </span>
                        </span>
                        <span className="text-gold">↗</span>
                      </Link>
                    </li>
                  ))}
                </ol>
                {hiddenCount > 0 && (
                  <div className="mt-3 border-t border-border pt-3 text-center">
                    <p className="text-xs text-muted mb-2">
                      {hiddenCount} more {hiddenCount === 1 ? "fighter" : "fighters"} in this division.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Link
                        href="/portal/sign-in"
                        className="inline-block bg-gold text-bg px-4 py-1.5 font-display font-bold text-[10px] tracking-wider uppercase rounded-full hover:bg-gold-hi"
                      >
                        Sign in
                      </Link>
                      <Link
                        href="/register"
                        className="inline-block border border-gold text-white px-4 py-1.5 font-display font-bold text-[10px] tracking-wider uppercase rounded-full hover:bg-gold hover:text-bg"
                      >
                        Register
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
