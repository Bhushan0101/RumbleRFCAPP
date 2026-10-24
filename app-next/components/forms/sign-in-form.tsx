"use client";

import { useActionState } from "react";
import { signInAction, type AuthState } from "@/app/actions/auth";

const initial: AuthState = { ok: false, message: "" };

export function SignInForm() {
  const [state, action, pending] = useActionState(signInAction, initial);
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
          className="w-full px-4 py-3 bg-bg border border-border text-white focus:border-gold outline-none"
        />
      </label>
      <label className="block">
        <span className="font-display text-xs tracking-wider text-gold uppercase block mb-1.5">
          Password
        </span>
        <input
          name="password"
          type="password"
          required
          className="w-full px-4 py-3 bg-bg border border-border text-white focus:border-gold outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-gold text-bg py-3.5 font-display font-bold text-xs tracking-wider uppercase hover:bg-gold-hi disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in →"}
      </button>
    </form>
  );
}
