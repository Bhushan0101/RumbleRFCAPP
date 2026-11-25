"use client";

import { useActionState } from "react";
import { submitFollowupAnswers } from "@/app/actions/onboarding";
import type { FormState } from "@/app/actions/public";

const initial: FormState = { ok: false, message: "" };

type Question = {
  id: number;
  question: string;
  answer: string;
  askedAt: string;
  answeredAt: string | null;
};

export function FollowupForm({
  token,
  gymName,
  questions,
}: {
  token: string;
  gymName: string;
  questions: Question[];
}) {
  const [state, action, pending] = useActionState(submitFollowupAnswers, initial);
  const open = questions.filter((q) => !q.answeredAt);
  const answered = questions.filter((q) => q.answeredAt);

  if (state.ok) {
    return (
      <div className="p-6 border border-emerald/60 bg-emerald/10 text-emerald-200 rounded-xl max-w-3xl">
        <p className="font-display text-lg text-white tracking-wider mb-2">
          Thanks — your answers are in.
        </p>
        <p className="text-sm">{state.message}</p>
      </div>
    );
  }

  if (open.length === 0) {
    return (
      <div className="p-6 border border-emerald/60 bg-emerald/10 text-emerald-200 rounded-xl max-w-3xl">
        <p className="font-display text-lg text-white tracking-wider mb-2">
          No open follow-up questions.
        </p>
        <p className="text-sm">
          A W.U.C.O admin hasn&apos;t sent you any outstanding questions for{" "}
          <strong>{gymName}</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {answered.length > 0 && (
        <section className="bg-surface border border-border rounded-xl p-5 space-y-3">
          <h2 className="font-display text-sm text-white tracking-wider">
            Previous answers
          </h2>
          <ul className="space-y-3 text-xs">
            {answered.map((q) => (
              <li key={q.id} className="border-l-2 border-gold/40 pl-3">
                <p className="text-gold font-display tracking-wider text-[11px] uppercase mb-1">
                  Q · {q.askedAt.slice(0, 10)}
                </p>
                <p className="text-white/90 mb-2 whitespace-pre-wrap">{q.question}</p>
                <p className="text-muted font-display tracking-wider text-[11px] uppercase mb-1">
                  A · {q.answeredAt?.slice(0, 10)}
                </p>
                <p className="text-white/80 whitespace-pre-wrap">{q.answer}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form
        action={action}
        className="bg-surface border border-border rounded-xl p-6 space-y-5"
      >
        <input type="hidden" name="token" value={token} />
        {state.message && (
          <p className="p-3 border text-sm border-red-500 bg-red-500/10 text-red-200 rounded">
            {state.message}
          </p>
        )}
        <h2 className="font-display text-lg text-white tracking-wider">
          Open questions ({open.length})
        </h2>
        <p className="text-xs text-muted">
          Please answer every open question below. When you&apos;re done, submit
          and the W.U.C.O admin team will take another look at your application.
        </p>
        <ol className="space-y-5">
          {open.map((q, i) => (
            <li key={q.id} className="border border-border rounded-lg p-4">
              <p className="font-display text-[10px] tracking-wider text-gold uppercase mb-1">
                Question {i + 1} · {q.askedAt.slice(0, 10)}
              </p>
              <p className="text-sm text-white mb-3 whitespace-pre-wrap">{q.question}</p>
              <label className="block">
                <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
                  Your answer
                </span>
                <textarea
                  name={`answer_${q.id}`}
                  required
                  rows={3}
                  maxLength={4000}
                  className="w-full px-3 py-2.5 bg-bg border border-border text-white text-sm rounded focus:border-gold outline-none"
                />
              </label>
            </li>
          ))}
        </ol>
        <button
          type="submit"
          disabled={pending}
          className="bg-gold text-bg px-6 py-3 font-display font-bold text-xs tracking-wider uppercase rounded-full hover:bg-gold-hi disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send answers to W.U.C.O admin"}
        </button>
      </form>
    </div>
  );
}
