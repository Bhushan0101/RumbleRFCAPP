"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { cn } from "@/lib/cn";
import { MARTIAL_ARTS } from "@/lib/martial-arts";
import { divisionDisplayName } from "@/lib/divisions";
import { RankMedal } from "@/components/ui/rank-medal";
import { requestFullRankings } from "@/app/actions/support";
import type { SupportState } from "@/app/actions/support";

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

const PUBLIC_LIMIT = 5;   // signed-out teaser
const FIGHTER_LIMIT = 10; // signed-in fighter default

const initialRequestState: SupportState = { ok: false, message: "" };

export function RankingsFullTable({
  rows,
  signedIn,
  canSeeFull,
}: {
  rows: RankingsFullRow[];
  signedIn: boolean;
  canSeeFull: boolean;
}) {
  const [discipline, setDiscipline] = React.useState<string>("all");
  const [requestState, requestAction, requestPending] = useActionState(
    requestFullRankings,
    initialRequestState,
  );

  const visibleRows =
    discipline === "all"
      ? rows
      : rows.filter((r) => r.disciplines.includes(discipline));

  const divisions = Array.from(new Set(visibleRows.map((r) => r.division)));

  // Decide the per-division cap.
  //   - Signed out            → top 5 + sign-in teaser.
  //   - Fighter (default)     → top 10 + "Request full rankings" button.
  //   - Promoter / admin      → full list.
  let perDivisionLimit: number | null;
  if (!signedIn) perDivisionLimit = PUBLIC_LIMIT;
  else if (canSeeFull) perDivisionLimit = null;
  else perDivisionLimit = FIGHTER_LIMIT; // fighter

  const anyHidden =
    perDivisionLimit != null &&
    divisions.some((d) => {
      const n = visibleRows.filter((r) => r.division === d).length;
      return n > (perDivisionLimit as number);
    });

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
              Sign in or register as a W.U.C.O fighter to see the top {FIGHTER_LIMIT}.
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

      {/* Fighter view: top-10 teaser + request for full access */}
      {signedIn && !canSeeFull && anyHidden && (
        <div
          className="mb-6 rounded-xl border-2 border-gold/60 p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-5"
          style={{ background: "linear-gradient(90deg, rgba(200,164,90,0.08), rgba(11,61,46,0.4))" }}
        >
          <div className="text-center md:text-left">
            <p className="font-display text-sm md:text-base text-white tracking-wider">
              You&apos;re seeing the top {FIGHTER_LIMIT} per division.
            </p>
            <p className="text-xs md:text-sm text-muted mt-1">
              Full national rankings are available to promoters. Ask a W.U.C.O
              admin to grant you access if you need to see them.
            </p>
            {requestState.message && (
              <p
                className={`text-xs mt-2 ${
                  requestState.ok ? "text-emerald-300" : "text-red-300"
                }`}
              >
                {requestState.message}
              </p>
            )}
          </div>
          <form action={requestAction}>
            <button
              type="submit"
              disabled={requestPending || requestState.ok}
              className="inline-block bg-gold text-bg px-5 py-2.5 font-display font-bold text-[11px] tracking-wider uppercase rounded-full hover:bg-gold-hi whitespace-nowrap disabled:opacity-60"
            >
              {requestPending
                ? "Sending…"
                : requestState.ok
                  ? "Request sent"
                  : "Request full rankings"}
            </button>
          </form>
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
            const shown =
              perDivisionLimit == null ? list : list.slice(0, perDivisionLimit);
            const hiddenCount =
              perDivisionLimit == null
                ? 0
                : Math.max(0, list.length - perDivisionLimit);
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
                    {!signedIn ? (
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
                    ) : (
                      <p className="text-[11px] text-muted italic">
                        Request full access above to see every ranked fighter.
                      </p>
                    )}
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
