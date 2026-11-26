"use client";

import * as React from "react";
import { useActionState } from "react";
import { saveGymClass, deleteGymClass } from "@/app/actions/club";
import type { ClubFlowState } from "@/app/actions/club";

const initial: ClubFlowState = { ok: false, message: "" };

export type GymClassRow = {
  id: number;
  title: string;
  discipline: string;
  dayOfWeek: number;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  perClassPriceCents: number | null;
  revolutUrl: string;
  colour: string;
};

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function ClubClassesForm({
  classes,
}: {
  classes: GymClassRow[];
}) {
  const [state, action, pending] = useActionState(saveGymClass, initial);
  const [editingId, setEditingId] = React.useState<number | null>(null);

  const editing = editingId
    ? classes.find((c) => c.id === editingId) ?? null
    : null;

  // Group classes by day for the list view.
  const byDay = React.useMemo(() => {
    const m = new Map<number, GymClassRow[]>();
    for (const c of classes) {
      const list = m.get(c.dayOfWeek) ?? [];
      list.push(c);
      m.set(c.dayOfWeek, list);
    }
    for (const list of m.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return m;
  }, [classes]);

  // Close the editor after a successful save.
  React.useEffect(() => {
    if (state.ok) setEditingId(null);
  }, [state.ok]);

  return (
    <div className="space-y-4">
      {/* Existing classes grouped by day */}
      {classes.length === 0 ? (
        <p className="text-xs text-muted border border-dashed border-border rounded-lg px-3 py-4 text-center">
          No weekly classes added yet. Use the form below to add your first.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 border border-border rounded-xl bg-bg/60">
          {DAYS.map((day, idx) => {
            const list = byDay.get(idx);
            if (!list || list.length === 0) return null;
            return (
              <li key={idx} className="px-3 py-3">
                <p className="font-display text-[10px] tracking-wider text-gold uppercase mb-2">
                  {day}
                </p>
                <ul className="space-y-1.5">
                  {list.map((c) => {
                    const price =
                      c.perClassPriceCents != null
                        ? `€${(c.perClassPriceCents / 100).toFixed(2)}`
                        : "—";
                    return (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-center gap-3 text-sm"
                      >
                        <span className="text-white font-display tracking-wider w-16">
                          {c.startTime}
                        </span>
                        <span className="text-white flex-1 min-w-0">
                          {c.title}
                          <span className="block text-[11px] text-muted">
                            {c.discipline || "—"} · {c.durationMinutes}m · cap {c.capacity} · {price}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingId(c.id)}
                          className="text-[11px] text-gold hover:underline"
                        >
                          edit
                        </button>
                        <form action={deleteGymClass}>
                          <input type="hidden" name="class_id" value={c.id} />
                          <button
                            type="submit"
                            className="text-[11px] text-red-400 hover:text-red-300 underline"
                          >
                            remove
                          </button>
                        </form>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}

      {/* Add / edit form */}
      <form
        action={action}
        key={editingId ?? "new"}
        className="bg-bg/60 border border-border rounded-xl p-4 space-y-3"
      >
        <p className="font-display text-xs tracking-wider text-gold uppercase">
          {editing ? `Edit class · ${editing.title}` : "Add a class"}
        </p>
        {editing && <input type="hidden" name="class_id" value={editing.id} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            name="title"
            label="Title"
            defaultValue={editing?.title ?? ""}
            required
          />
          <Field
            name="discipline"
            label="Discipline"
            defaultValue={editing?.discipline ?? ""}
            placeholder="Kickboxing / Muay Thai / BJJ…"
          />
          <label className="block">
            <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
              Day of week <span className="text-red-400 ml-1">*</span>
            </span>
            <select
              name="day_of_week"
              required
              defaultValue={String(editing?.dayOfWeek ?? "")}
              className="w-full px-3 py-2 bg-bg border border-border text-white text-sm rounded"
            >
              <option value="" disabled>
                — pick a day —
              </option>
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <Field
            name="start_time"
            label="Start time (HH:MM)"
            defaultValue={editing?.startTime ?? ""}
            placeholder="18:00"
            required
          />
          <Field
            name="duration_minutes"
            label="Duration (min)"
            type="number"
            defaultValue={String(editing?.durationMinutes ?? 60)}
            required
          />
          <Field
            name="capacity"
            label="Capacity"
            type="number"
            defaultValue={String(editing?.capacity ?? 20)}
          />
          <Field
            name="per_class_price_eur"
            label="Drop-in price (€, optional)"
            defaultValue={
              editing?.perClassPriceCents != null
                ? (editing.perClassPriceCents / 100).toFixed(2)
                : ""
            }
            placeholder="15.00"
          />
          <Field
            name="revolut_url"
            label="Revolut payment URL (optional)"
            defaultValue={editing?.revolutUrl ?? ""}
            placeholder="https://revolut.me/…"
          />
        </div>
        {state.message && (
          <p
            className={`text-xs ${state.ok ? "text-emerald-300" : "text-red-300"}`}
          >
            {state.message}
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="bg-emerald text-white px-4 py-2 text-xs font-display tracking-wider hover:bg-emerald-hi rounded disabled:opacity-50"
          >
            {pending ? "Saving…" : editing ? "Save changes" : "Add class"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="border border-border text-white px-3 py-2 text-xs font-display tracking-wider rounded"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
  required,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-bg border border-border text-white text-sm rounded"
      />
    </label>
  );
}
