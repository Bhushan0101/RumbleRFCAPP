"use client";

import { useActionState } from "react";
import { requestPasswordReset, type ResetState } from "@/app/actions/auth";

const initial: ResetState = { ok: false, message: "" };

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initial);

  if (state.ok) {
    return (
      <div className="p-4 border border-emerald/60 bg-emerald/10 text-emerald text-sm rounded-lg">
        {state.message}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.message && (
        <p className="p-3 border border-red-500 bg-red-500/10 text-red-200 text-sm">
          {state.message}
        </p>
      )}
      <label className="block">
        <span className="font-display text-xs tracking-wider text-gold uppercase block mb-1.5">
          Email
        </span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full px-4 py-3 bg-bg border border-border text-white focus:border-gold outline-none"
        />
      </label>
      <p className="text-xs text-muted">
        Enter the email you registered with. If an account exists, we&apos;ll
        email a single-use reset link that stays valid for 10 minutes.
      </p>
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-gold text-bg py-3.5 font-display font-bold text-xs tracking-wider uppercase hover:bg-gold-hi disabled:opacity-50"
      >
        {pending ? "Sending…" : "Request a reset →"}
      </button>
    </form>
  );
}
