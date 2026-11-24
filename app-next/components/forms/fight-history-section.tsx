"use client";

import * as React from "react";
import { useActionState } from "react";
import { addFightHistory, deleteFightHistory, type ProfileState } from "@/app/actions/profile";

const initial: ProfileState = { ok: false, message: "" };

type Item = {
  id: number;
  fightDate: string;
  opponent: string;
  eventName: string;
  location: string;
  result: string;
  method: string;
  notes: string;
};

export function FightHistorySection({
  items,
  declared,
  verified,
}: {
  items: Item[];
  declared: { wins: number; losses: number; draws: number };
  verified: { wins: number; losses: number; draws: number };
}) {
  const [state, action, pending] = useActionState(addFightHistory, initial);
  const [showForm, setShowForm] = React.useState(items.length === 0);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state.ok && formRef.current) {
      formRef.current.reset();
      setShowForm(false);
    }
  }, [state.ok]);

  const remaining = {
    win: Math.max(0, declared.wins - verified.wins),
    loss: Math.max(0, declared.losses - verified.losses),
    draw: Math.max(0, declared.draws - verified.draws),
  };
  const totalRemaining = remaining.win + remaining.loss + remaining.draw;
  const declaredTotal = declared.wins + declared.losses + declared.draws;

  return (
    <div className="space-y-5">
      {/* Declared vs Verified */}
      <div className="grid gap-3 sm:grid-cols-2 bg-bg/60 border border-border rounded-xl p-4">
        <div>
          <p className="text-[10px] font-display tracking-widest text-gold uppercase">
            Declared at signup
          </p>
          <p className="font-display text-2xl text-white mt-1">
            {declared.wins}–{declared.losses}–{declared.draws}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-display tracking-widest text-emerald uppercase">
            Verified (logged)
          </p>
          <p className="font-display text-2xl text-white mt-1">
            {verified.wins}–{verified.losses}–{verified.draws}
          </p>
        </div>
      </div>
      {declaredTotal > 0 && (
        <p className="text-xs text-muted">
          {totalRemaining > 0 ? (
            <>
              <span className="text-gold">{totalRemaining}</span> fight
              {totalRemaining === 1 ? "" : "s"} still to log —{" "}
              {remaining.win > 0 && <span>{remaining.win} win{remaining.win === 1 ? "" : "s"}</span>}
              {remaining.win > 0 && (remaining.loss > 0 || remaining.draw > 0) && ", "}
              {remaining.loss > 0 && <span>{remaining.loss} loss{remaining.loss === 1 ? "" : "es"}</span>}
              {remaining.loss > 0 && remaining.draw > 0 && ", "}
              {remaining.draw > 0 && <span>{remaining.draw} draw{remaining.draw === 1 ? "" : "s"}</span>}
              .
            </>
          ) : (
            <span className="text-emerald-300">
              ✓ All declared fights logged.
            </span>
          )}
        </p>
      )}
      {declaredTotal === 0 && (
        <p className="text-xs text-muted">
          You declared no prior fights at signup. Request a correction if that's wrong.
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-muted">No fights recorded yet.</p>
      ) : (
        <ol className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-start gap-3 px-4 py-3 bg-bg"
            >
              <span
                className={`font-display text-xs tracking-wider px-2 py-1 rounded uppercase ${
                  it.result === "win"
                    ? "bg-emerald text-white"
                    : it.result === "loss"
                      ? "bg-red-500 text-white"
                      : "bg-orange-500 text-white"
                }`}
              >
                {it.result}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">
                  vs <span className="font-medium">{it.opponent}</span>
                  {it.method && <span className="text-muted"> · {it.method}</span>}
                </p>
                <p className="text-[11px] text-muted">
                  {it.fightDate}
                  {it.eventName && ` · ${it.eventName}`}
                  {it.location && ` · ${it.location}`}
                </p>
                {it.notes && (
                  <p className="text-[11px] text-muted mt-1">{it.notes}</p>
                )}
              </div>
              <form action={deleteFightHistory}>
                <input type="hidden" name="id" value={it.id} />
                <button
                  type="submit"
                  aria-label="Delete fight"
                  className="text-xs text-red-400 hover:underline"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ol>
      )}

      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-xs text-gold underline"
        >
          + Add a fight
        </button>
      ) : (
        <form ref={formRef} action={action} className="space-y-3 border border-border rounded-xl p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <LabelledInput name="fight_date" label="Date" type="date" required />
            <LabelledInput name="opponent" label="Opponent" required />
            <LabelledInput name="event_name" label="Event / promotion" />
            <LabelledInput name="location" label="Location" />
            <label className="block">
              <span className="text-xs text-gold tracking-wider uppercase mb-1.5 block">
                Result <span className="text-red-400">*</span>
              </span>
              <select
                name="result"
                required
                defaultValue=""
                className="w-full px-4 py-3 bg-bg border border-border text-white rounded-lg focus:border-gold outline-none"
              >
                <option value="" disabled>Select…</option>
                <option value="win" disabled={remaining.win === 0}>
                  Win{remaining.win === 0 ? " — all logged" : ` (${remaining.win} left)`}
                </option>
                <option value="loss" disabled={remaining.loss === 0}>
                  Loss{remaining.loss === 0 ? " — all logged" : ` (${remaining.loss} left)`}
                </option>
                <option value="draw" disabled={remaining.draw === 0}>
                  Draw{remaining.draw === 0 ? " — all logged" : ` (${remaining.draw} left)`}
                </option>
              </select>
            </label>
            <LabelledInput name="method" label="Method" placeholder="KO, Decision, Submission…" />
          </div>
          <label className="block">
            <span className="text-xs text-gold tracking-wider uppercase mb-1.5 block">
              Notes
            </span>
            <textarea
              name="notes"
              rows={2}
              maxLength={2000}
              className="w-full px-4 py-3 bg-bg border border-border text-white rounded-lg focus:border-gold outline-none"
            />
          </label>
          {state.message && (
            <p className={`text-xs ${state.ok ? "text-emerald-300" : "text-red-400"}`}>
              {state.message}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="bg-emerald text-white px-5 py-2.5 font-display text-xs tracking-wider rounded-full disabled:opacity-50"
            >
              {pending ? "Adding…" : "Add fight"}
            </button>
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-xs text-muted hover:text-white"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function LabelledInput({
  name,
  label,
  type = "text",
  required,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-gold tracking-wider uppercase mb-1.5 block">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-bg border border-border text-white rounded-lg focus:border-gold outline-none"
      />
    </label>
  );
}
