"use client";

import * as React from "react";
import { useActionState } from "react";
import { bookClass, type FormState } from "@/app/actions/public";

const initial: FormState = { ok: false, message: "" };

export function BookingDialog({
  classId,
  classTitle,
  day,
  time,
  revolutUrl,
  price,
}: {
  classId: number;
  classTitle: string;
  day: string;
  time: string;
  revolutUrl: string;
  price: number | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = useActionState(bookClass, initial);
  React.useEffect(() => {
    if (state.ok && revolutUrl) {
      const t = setTimeout(() => {
        window.open(revolutUrl, "_blank", "noopener");
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [state.ok, revolutUrl]);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1.5 w-full bg-gold text-bg py-1 px-2 font-display text-[10px] tracking-wider hover:bg-gold-hi"
      >
        BOOK
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border-2 border-gold max-w-md w-full p-6">
            <h3 className="font-display text-xl text-white tracking-wider mb-1">
              BOOK CLASS
            </h3>
            <p className="text-muted text-sm mb-4">
              {classTitle} · {day} {time}
              {price != null && (
                <span className="text-gold ml-2">
                  €{(price / 100).toFixed(2)}
                </span>
              )}
            </p>
            {state.message && (
              <p
                className={`p-3 mb-3 text-sm ${
                  state.ok
                    ? "bg-emerald/20 text-white border border-emerald"
                    : "bg-red-500/10 text-red-200 border border-red-500"
                }`}
              >
                {state.message}
              </p>
            )}
            <form action={action} className="space-y-3">
              <input type="hidden" name="class_id" value={classId} />
              <label className="block">
                <span className="font-display text-xs tracking-wider text-gold uppercase block mb-1">
                  Date
                </span>
                <input
                  type="date"
                  name="booked_for_date"
                  required
                  className="w-full px-3 py-2 bg-bg border border-border text-white"
                />
              </label>
              <label className="block">
                <span className="font-display text-xs tracking-wider text-gold uppercase block mb-1">
                  Your name
                </span>
                <input
                  type="text"
                  name="guest_name"
                  required
                  className="w-full px-3 py-2 bg-bg border border-border text-white"
                />
              </label>
              <label className="block">
                <span className="font-display text-xs tracking-wider text-gold uppercase block mb-1">
                  Email
                </span>
                <input
                  type="email"
                  name="guest_email"
                  required
                  className="w-full px-3 py-2 bg-bg border border-border text-white"
                />
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 border border-gold text-white py-2 font-display text-[11px] tracking-wider"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 bg-gold text-bg py-2 font-display font-bold text-[11px] tracking-wider disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Confirm →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
