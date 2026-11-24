"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { MARTIAL_ARTS } from "@/lib/martial-arts";

const CATEGORIES: Array<{ id: "men" | "women" | "juniors"; label: string }> = [
  { id: "men", label: "MEN" },
  { id: "women", label: "WOMEN" },
  { id: "juniors", label: "JUNIORS" },
];
const CAT_PREFIX = { men: "MEN'S", women: "WOMEN'S", juniors: "JUNIOR" };

const DISCIPLINES: Array<{ id: string; label: string }> = [
  { id: "all", label: "ALL" },
  ...MARTIAL_ARTS.map((m) => ({ id: m.id, label: m.name.toUpperCase() })),
];

const MENS_KG = [57, 60, 63, 67, 70, 72, 75, 80, 85];
const WOMENS_KG = [55, 57, 60, 62];
// Legacy non-weight categories used by MMA in the schema.
const OPEN_CATEGORIES = ["Featherweight", "Lightweight"];

function weightsFor(
  category: "men" | "women" | "juniors",
  discipline: string,
): string[] {
  // MMA uses open categories, not kg weights (schema doesn't model kg for it yet).
  if (discipline === "mma") return OPEN_CATEGORIES;
  if (category === "women") return WOMENS_KG.map((k) => `${k}`);
  // Men + juniors default to the men's kg set.
  return MENS_KG.map((k) => `${k}`);
}

function formatWeightLabel(w: string, discipline: string): string {
  if (discipline === "mma") return w.toUpperCase();
  return `${w} KG`;
}

export type RankingRow = {
  id: number;
  position: number;
  division: string;
  athleteId: number;
  name: string;
  martialArt: string;
  classCode: string | null;
  gender: string;
  wins: number;
  losses: number;
  draws: number;
  fighterNo: string | null;
};

export function RankingsPanel({ rankings }: { rankings: RankingRow[] }) {
  const [category, setCategory] = React.useState<"men" | "women" | "juniors">(
    "men",
  );
  const [discipline, setDiscipline] = React.useState<string>("all");

  const weights = weightsFor(category, discipline);

  // Figure out which weights actually have ranked fighters for the current
  // category + discipline. Used to default to a populated weight instead of
  // landing the user on an empty one.
  const populatedWeights = React.useMemo(() => {
    const pool = rankings.filter((r) => {
      if (discipline !== "all" && r.martialArt !== discipline) return false;
      if (category === "juniors") {
        if (r.classCode !== "J") return false;
      } else if (category === "men") {
        if (r.gender !== "male") return false;
        if (r.classCode === "J") return false;
      } else if (category === "women") {
        if (r.gender !== "female") return false;
        if (r.classCode === "J") return false;
      }
      return true;
    });
    const hits = new Set<string>();
    for (const w of weights) {
      const slug = discipline === "mma" ? w : `${w}kg`;
      if (pool.some((r) => r.division.toLowerCase().includes(slug.toLowerCase()))) {
        hits.add(w);
      }
    }
    return hits;
  }, [rankings, category, discipline, weights]);

  const [weight, setWeight] = React.useState<string>(
    () => weights.find((w) => populatedWeights.has(w)) ?? weights[0] ?? "",
  );

  // When category or discipline changes, prefer a populated weight.
  React.useEffect(() => {
    if (!weights.includes(weight) || !populatedWeights.has(weight)) {
      const firstWithData = weights.find((w) => populatedWeights.has(w));
      setWeight(firstWithData ?? weights[0] ?? "");
    }
  }, [weights, weight, populatedWeights]);

  const filtered = rankings
    .filter((r) => {
      if (discipline !== "all" && r.martialArt !== discipline) return false;
      if (category === "juniors") {
        if (r.classCode !== "J") return false;
      } else if (category === "men") {
        if (r.gender !== "male") return false;
        if (r.classCode === "J") return false;
      } else if (category === "women") {
        if (r.gender !== "female") return false;
        if (r.classCode === "J") return false;
      }
      // Division id formats: "M-70kg", "F-55kg", "MMA-Lightweight".
      // Weight slug built dynamically so it matches either style.
      const slug =
        discipline === "mma"
          ? weight
          : `${weight}kg`;
      if (!r.division.toLowerCase().includes(slug.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => a.position - b.position)
    .slice(0, 10);

  const isOpen = discipline === "mma";

  return (
    <section className="bg-surface border border-border overflow-hidden rounded-2xl">
      <header className="flex items-center justify-between px-6 py-5 border-b border-border bg-surface-3">
        <h2 className="font-display text-lg tracking-wider text-white">
          NATIONAL RANKINGS
        </h2>
        <Link
          href="/rankings"
          className="text-xs font-display tracking-wider text-gold border-b border-gold pb-1 hover:text-gold-hi"
        >
          VIEW ALL ↗
        </Link>
      </header>

      {/* Category tabs — hidden when MMA selected since it's open-weight for now */}
      {!isOpen && (
        <div
          className="flex gap-1 border-b border-border px-5 pt-4"
          role="tablist"
        >
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={category === c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                "px-5 py-2 font-display font-bold text-[10px] tracking-wider border -mb-px rounded-t-md",
                category === c.id
                  ? "bg-gold text-bg border-gold"
                  : "bg-transparent text-[#cfe3d8] border-border hover:text-gold",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Discipline filter row */}
      <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-border bg-[#0b1517]">
        <span className="text-[10px] font-display tracking-wider text-gold self-center mr-2">
          DISCIPLINE
        </span>
        {DISCIPLINES.map((d) => (
          <button
            key={d.id}
            onClick={() => setDiscipline(d.id)}
            className={cn(
              "px-3 py-1 font-display font-bold text-[10px] tracking-wider rounded-full border",
              discipline === d.id
                ? "bg-emerald text-white border-emerald"
                : "bg-transparent text-[#cfe3d8] border-border hover:text-gold",
            )}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[160px_1fr] min-h-[300px]">
        {/* Weight / category sidebar */}
        <div className="bg-[#0b1517] p-3 flex flex-col gap-1">
          <p className="text-[9px] font-display tracking-widest text-gold uppercase pl-3 pb-1">
            {isOpen ? "Category" : "Weight"}
          </p>
          {weights.map((w) => (
            <button
              key={w}
              onClick={() => setWeight(w)}
              className={cn(
                "py-2 px-3 font-display font-bold text-[10px] tracking-wider text-center rounded",
                weight === w
                  ? "bg-gold text-bg"
                  : "bg-transparent text-[#cfe3d8] hover:text-gold",
              )}
            >
              {formatWeightLabel(w, discipline)}
            </button>
          ))}
        </div>

        {/* Ranking table */}
        <div className="p-4">
          <div className="flex items-end justify-between mb-3">
            <p className="font-display font-black text-xl text-white tracking-wider">
              {!isOpen && (
                <>
                  {CAT_PREFIX[category]}{" "}
                  <span className="text-gold">
                    {formatWeightLabel(weight, discipline)}
                  </span>
                </>
              )}
              {isOpen && (
                <>
                  <span className="text-gold uppercase">
                    {formatWeightLabel(weight, discipline)}
                  </span>
                </>
              )}
              {discipline !== "all" && (
                <span className="text-xs text-muted ml-2 tracking-wider uppercase">
                  · {DISCIPLINES.find((d) => d.id === discipline)?.label}
                </span>
              )}
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-[220px] border border-dashed border-border rounded-xl text-sm text-muted text-center p-6">
              No ranked fighters in this filter yet.
            </div>
          ) : (
            <ol className="divide-y divide-border/60 rounded-xl border border-border overflow-hidden bg-bg/50">
              {filtered.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/fighters/${r.athleteId}`}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-3 transition-colors"
                  >
                    <span
                      className={cn(
                        "font-display font-black text-base w-7 text-center rounded",
                        r.position === 1 && "text-gold",
                        r.position === 2 && "text-neutral-300",
                        r.position === 3 && "text-orange-400",
                        r.position > 3 && "text-muted",
                      )}
                    >
                      {r.position}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="text-white block font-display tracking-wider truncate">
                        {r.name}
                      </span>
                      <span className="text-[10px] text-muted">
                        {r.wins}-{r.losses}-{r.draws}
                        {r.fighterNo && <> · {r.fighterNo}</>}
                      </span>
                    </span>
                    <span className="text-gold text-xs">↗</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-4 text-center">
            <Link
              href={`/rankings?category=${category}&weight=${encodeURIComponent(weight)}${discipline !== "all" ? `&discipline=${discipline}` : ""}`}
              className="inline-block border border-gold px-5 py-2.5 font-display font-bold text-[11px] tracking-wider text-white hover:bg-gold hover:text-bg transition-colors rounded-full"
            >
              VIEW FULL RANKINGS →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
