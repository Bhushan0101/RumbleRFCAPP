"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  completePasswordReset,
  type ResetState,
} from "@/app/actions/auth";

const initial: ResetState = { ok: false, message: "" };

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(completePasswordReset, initial);

  if (state.ok) {
    return (
      <div className="space-y-4">
        <div className="p-3 border border-emerald/60 bg-emerald/10 text-emerald text-sm rounded-lg">
          {state.message}
        </div>
        <Link
          href="/portal/sign-in"
          className="inline-block bg-gold text-bg px-5 py-2.5 font-display font-bold text-xs tracking-wider uppercase rounded-full hover:bg-gold-hi"
        >
          Sign in →
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.message && (
        <p className="p-3 border border-red-500 bg-red-500/10 text-red-200 text-sm rounded">
          {state.message}
        </p>
      )}
      <label className="block">
        <span className="font-display text-xs tracking-wider text-gold uppercase block mb-1.5">
          New password
        </span>
        <input
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className="w-full px-4 py-3 bg-bg border border-border text-white focus:border-gold outline-none"
        />
        <span className="block text-xs text-muted mt-1">At least 10 characters.</span>
      </label>
      <label className="block">
        <span className="font-display text-xs tracking-wider text-gold uppercase block mb-1.5">
          Confirm new password
        </span>
        <input
          name="confirm"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className="w-full px-4 py-3 bg-bg border border-border text-white focus:border-gold outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-gold text-bg py-3.5 font-display font-bold text-xs tracking-wider uppercase hover:bg-gold-hi disabled:opacity-50"
      >
        {pending ? "Saving…" : "Reset password"}
      </button>
    </form>
  );
}
