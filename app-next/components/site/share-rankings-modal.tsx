"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { shareRankingsWithUser, rejectRankingsRequest } from "@/app/actions/admin";
import { ALL_DIVISIONS } from "@/lib/divisions";

export type RankingRequestForModal = {
  id: number;
  requesterName: string;
  requesterEmail: string;
  fighterNo: string | null;
  currentDivision: string;
  primaryDiscipline: string;
  gymName: string | null;
  note: string;
  createdAt: string;
};

export function ShareRankingsModal({
  requests,
}: {
  requests: RankingRequestForModal[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const openId = params.get("open");
  const current = openId ? requests.find((r) => String(r.id) === openId) : null;
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const [scope, setScope] = React.useState<string>("full");

  // Default the division dropdown to the requester's current division if they
  // have one, otherwise fall back to "full".
  React.useEffect(() => {
    if (!current) return;
    setScope("full");
  }, [current]);

  // Esc / backdrop close.
  React.useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  function closeModal() {
    // Strip ?open from the URL to close.
    const next = new URLSearchParams(params.toString());
    next.delete("open");
    const qs = next.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share rankings"
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      <div
        className="absolute inset-0 bg-black/70"
        onClick={closeModal}
        aria-hidden
      />
      <div
        ref={dialogRef}
        className="relative w-full max-w-lg bg-surface border border-gold/50 rounded-2xl shadow-2xl p-5 md:p-6 my-6"
      >
        <header className="mb-3">
          <p className="font-display text-[10px] tracking-widest text-gold uppercase">
            Ranking share request
          </p>
          <h2 className="font-display text-xl text-white tracking-wider mt-1">
            {current.requesterName}
            {current.fighterNo && (
              <span className="ml-2 text-xs text-gold">{current.fighterNo}</span>
            )}
          </h2>
          <p className="text-[11px] text-muted mt-1">
            {current.requesterEmail}
            {current.currentDivision && ` · ${current.currentDivision}`}
            {current.primaryDiscipline && ` · ${current.primaryDiscipline}`}
            {current.gymName && ` · ${current.gymName}`}
          </p>
          <p className="text-[10px] text-muted mt-1">
            asked {current.createdAt}
          </p>
        </header>

        {current.note && (
          <pre className="whitespace-pre-wrap text-[11px] text-white/80 bg-bg border border-border rounded-lg p-3 max-h-32 overflow-y-auto">
            {current.note}
          </pre>
        )}

        <form action={shareRankingsWithUser} className="mt-4 space-y-3">
          <input type="hidden" name="request_id" value={current.id} />
          <label className="block">
            <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1.5">
              What should they see?
            </span>
            <select
              name="scope"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full px-3 py-2.5 bg-bg border border-border text-white text-sm rounded-lg"
            >
              <option value="full">Full national rankings (every division)</option>
              <optgroup label="Single division only">
                {ALL_DIVISIONS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </optgroup>
            </select>
            <span className="text-[11px] text-muted mt-1 block">
              Share mints a signed link valid for 24 hours and emails it to{" "}
              {current.requesterEmail}.
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              type="submit"
              className="bg-emerald text-white px-4 py-2 font-display font-bold text-[11px] tracking-wider uppercase rounded-full hover:bg-emerald-hi"
            >
              Share (24h) →
            </button>
            <button
              type="button"
              onClick={closeModal}
              className="border border-border text-white px-4 py-2 font-display font-bold text-[11px] tracking-wider uppercase rounded-full hover:border-gold"
            >
              Cancel
            </button>
          </div>
        </form>

        <form action={rejectRankingsRequest} className="mt-3 pt-3 border-t border-border">
          <input type="hidden" name="request_id" value={current.id} />
          <button
            type="submit"
            className="text-[11px] text-red-300 hover:text-red-200 font-display tracking-wider underline"
          >
            Decline this request instead
          </button>
        </form>
      </div>
    </div>
  );
}
