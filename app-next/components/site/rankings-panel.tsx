"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/cn";

const WEIGHTS = ["-57", "-60", "-63", "-67", "-70", "-72", "-75", "-80", "-85", "+85"];
const CATEGORIES: Array<{ id: "men" | "women" | "juniors"; label: string }> = [
  { id: "men", label: "MEN" },
  { id: "women", label: "WOMEN" },
  { id: "juniors", label: "JUNIORS" },
];
const CAT_PREFIX = { men: "MEN'S", women: "WOMEN'S", juniors: "JUNIOR" };

export function RankingsPanel() {
  const [category, setCategory] = React.useState<"men" | "women" | "juniors">(
    "men",
  );
  const [weight, setWeight] = React.useState("-70");

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
      <div className="flex gap-1 border-b border-border px-5 pt-4" role="tablist">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={category === c.id}
            onClick={() => setCategory(c.id)}
            className={cn(
              "px-5 py-2 font-display font-bold text-[10px] tracking-wider border -mb-px",
              category === c.id
                ? "bg-gold text-bg border-gold"
                : "bg-transparent text-[#cfe3d8] border-border hover:text-gold",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[110px_1fr] sm:grid-cols-[150px_1fr] min-h-[300px]">
        <div className="bg-[#0b1517] p-3 flex flex-col gap-1">
          {WEIGHTS.map((w) => (
            <button
              key={w}
              onClick={() => setWeight(w)}
              className={cn(
                "py-2 px-3 font-display font-bold text-[11px] tracking-wider text-center",
                weight === w
                  ? "bg-gold text-bg"
                  : "bg-transparent text-[#cfe3d8] hover:text-gold",
              )}
            >
              {w} KG
            </button>
          ))}
        </div>
        <div
          className="relative flex flex-col justify-end items-center p-6 min-h-[300px]"
          style={{
            backgroundImage:
              "linear-gradient(135deg,rgba(0,107,79,.3),rgba(10,21,16,.5)),url('/brand/arena.webp')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-bg/80 via-bg/30 to-bg/50 pointer-events-none" />
          <div className="relative z-10 text-center">
            <p className="font-display font-black text-2xl sm:text-3xl text-white tracking-wider">
              {CAT_PREFIX[category]}
            </p>
            <p className="font-display font-black text-3xl sm:text-5xl text-white tracking-widest mt-1">
              {weight} KG RANKINGS
            </p>
            <Link
              href={`/rankings?category=${category}&weight=${encodeURIComponent(weight)}`}
              className="inline-block mt-6 border border-gold px-6 py-3 font-display font-bold text-[11px] tracking-wider text-white hover:bg-gold hover:text-bg transition-colors rounded-full"
            >
              VIEW RANKINGS →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
