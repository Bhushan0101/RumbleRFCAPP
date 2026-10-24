"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import {
  submitCorrectionRequest,
  type CorrectionState,
} from "@/app/actions/correction";
import { cn } from "@/lib/cn";

const initial: CorrectionState = { ok: false, message: "" };

export function RequestCorrectionButton() {
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = useActionState(
    submitCorrectionRequest,
    initial,
  );
  React.useEffect(() => {
    if (state.ok) {
      const t = setTimeout(() => setOpen(false), 2500);
      return () => clearTimeout(t);
    }
  }, [state.ok]);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 border border-gold/60 text-gold py-3 font-display font-bold text-xs tracking-wider rounded-full hover:bg-gold hover:text-bg w-full"
      >
        <AlertCircle className="size-4" />
        Request a correction
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-2xl tracking-wider text-[#07251b]">
                  Request a correction
                </h2>
                <p className="text-sm text-neutral-500 mt-1">
                  Something wrong on your record? Describe what needs changing
                  and the W.U.C.O admin team will investigate.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {state.message && (
              <p
                className={cn(
                  "mt-4 p-3 rounded-lg text-sm border",
                  state.ok
                    ? "bg-emerald/10 text-emerald-ink border-emerald/30"
                    : "bg-red-50 text-red-700 border-red-200",
                )}
              >
                {state.message}
              </p>
            )}
            <form action={action} className="mt-5 space-y-3">
              <label className="block">
                <span className="font-display text-[11px] tracking-wider text-neutral-600 uppercase block mb-1.5">
                  What needs to be corrected?
                </span>
                <textarea
                  name="details"
                  required
                  rows={6}
                  minLength={10}
                  maxLength={4000}
                  placeholder="e.g. My record shows 5-1-0 but I had another win on 12 March 2025 at Dublin Open. Fighter: Jane Doe vs me."
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded-lg text-[#07251b] focus:border-emerald outline-none"
                />
              </label>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-5 py-2.5 rounded-full border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-5 py-2.5 rounded-full bg-emerald text-white font-display font-bold text-xs tracking-wider uppercase hover:bg-emerald-hi disabled:opacity-50"
                >
                  {pending ? "Sending…" : "Send request →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
