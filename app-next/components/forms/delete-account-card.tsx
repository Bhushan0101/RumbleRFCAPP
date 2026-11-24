"use client";

import * as React from "react";
import { useActionState } from "react";
import { signOut } from "next-auth/react";
import { requestAccountDeletion, type DeletionState } from "@/app/actions/profile";

const initial: DeletionState = { ok: false, message: "" };

export function DeleteAccountCard() {
  const [open, setOpen] = React.useState(false);
  const [confirmPhrase, setConfirmPhrase] = React.useState("");
  const [state, action, pending] = useActionState(requestAccountDeletion, initial);
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  // When the server action reports success, sign the user out and redirect home.
  React.useEffect(() => {
    if (state.ok) {
      const t = setTimeout(() => {
        void signOut({ callbackUrl: "/" });
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [state.ok]);

  React.useEffect(() => {
    if (open) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [open]);

  const canConfirm = confirmPhrase.trim().toUpperCase() === "DELETE";

  return (
    <div className="bg-surface border border-red-500/40 rounded-xl p-5 md:p-6">
      <h2 className="font-display text-lg md:text-xl tracking-wider text-red-400 uppercase mb-2">
        Danger zone
      </h2>
      <p className="text-sm text-muted mb-4">
        Request to close your W.U.C.O account. A W.U.C.O admin will review your
        request and action it. Your fighter passport will be withdrawn and your
        profile removed from public listings. You may share a reason — it&apos;s
        optional.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 border border-red-500 text-red-400 px-5 py-2.5 font-display font-bold text-xs tracking-wider uppercase rounded-full hover:bg-red-500 hover:text-white"
      >
        Request account deletion
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="backdrop:bg-black/70 rounded-xl p-0 bg-transparent max-w-lg w-full"
      >
        <div className="bg-bg border-2 border-red-500/60 rounded-xl p-5 md:p-6">
          {state.ok ? (
            <>
              <h3 className="font-display text-base md:text-lg tracking-wider text-emerald uppercase mb-2">
                Request submitted
              </h3>
              <p className="text-sm text-white mb-2">{state.message}</p>
              <p className="text-xs text-muted">
                You&apos;ll be signed out in a moment…
              </p>
            </>
          ) : (
            <form action={action} className="space-y-4">
              <h3 className="font-display text-base md:text-lg tracking-wider text-red-400 uppercase">
                Confirm account deletion
              </h3>
              <p className="text-sm text-muted">
                This submits a request to a W.U.C.O admin to close your account.
                You can share a reason if you&apos;d like, or leave it blank.
              </p>
              <label className="block">
                <span className="block font-display text-xs tracking-wider text-gold uppercase mb-1.5">
                  Reason <span className="text-muted">(optional)</span>
                </span>
                <textarea
                  name="reason"
                  rows={4}
                  maxLength={2000}
                  placeholder="Tell us why you're leaving — or leave blank to just submit."
                  className="w-full px-3 py-2 bg-bg border border-border text-white text-sm focus:border-gold outline-none rounded-lg"
                />
              </label>
              <label className="block">
                <span className="block font-display text-xs tracking-wider text-gold uppercase mb-1.5">
                  Type <span className="text-red-400">DELETE</span> to confirm
                </span>
                <input
                  type="text"
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  autoComplete="off"
                  className="w-full px-3 py-2 bg-bg border border-border text-white text-sm focus:border-red-500 outline-none rounded-lg"
                />
              </label>
              {state.message && !state.ok && (
                <p className="text-xs text-red-400">{state.message}</p>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setConfirmPhrase("");
                  }}
                  className="border border-border text-white px-5 py-2 font-display font-bold text-xs tracking-wider uppercase rounded-full hover:border-gold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || !canConfirm}
                  className="bg-red-500 text-white px-5 py-2 font-display font-bold text-xs tracking-wider uppercase rounded-full hover:bg-red-600 disabled:opacity-50"
                >
                  {pending ? "Submitting…" : "Delete my account"}
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </div>
  );
}
