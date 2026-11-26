"use client";

import * as React from "react";
import { useActionState } from "react";
import { saveGymProduct, deleteGymProduct } from "@/app/actions/club";
import type { ClubFlowState } from "@/app/actions/club";

const initial: ClubFlowState = { ok: false, message: "" };

export type GymProductRow = {
  id: number;
  kind: string;
  title: string;
  priceCents: number;
  revolutUrl: string;
  active: number;
};

const KINDS: Array<{ id: string; label: string; defaultTitle: string }> = [
  { id: "day_pass", label: "Single day pass", defaultTitle: "Day pass" },
  { id: "weekly_pass", label: "Weekly pass", defaultTitle: "Weekly pass" },
  { id: "monthly_pass", label: "Monthly pass", defaultTitle: "Monthly pass" },
  { id: "per_class", label: "Per-class drop-in", defaultTitle: "Per-class drop-in" },
];

export function ClubPassesForm({ products }: { products: GymProductRow[] }) {
  const [state, action, pending] = useActionState(saveGymProduct, initial);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [addingKind, setAddingKind] = React.useState<string | null>(null);

  const editing = editingId
    ? products.find((p) => p.id === editingId) ?? null
    : null;

  // Reset the form after a successful save.
  React.useEffect(() => {
    if (state.ok) {
      setEditingId(null);
      setAddingKind(null);
    }
  }, [state.ok]);

  const open = editing || addingKind;

  return (
    <div className="space-y-4">
      {products.length === 0 ? (
        <p className="text-xs text-muted border border-dashed border-border rounded-lg px-3 py-4 text-center">
          No passes configured yet. Add passes below to let drop-ins and
          members pay through your Revolut link.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 border border-border rounded-xl bg-bg/60">
          {products.map((p) => (
            <li key={p.id} className="px-3 py-3 flex flex-wrap items-center gap-3">
              <span className="font-display text-white tracking-wider flex-1 min-w-0">
                {p.title}
                <span className="block text-[11px] text-muted">
                  {KINDS.find((k) => k.id === p.kind)?.label ?? p.kind}
                  {p.active ? "" : " · hidden"}
                  {p.revolutUrl && " · Revolut linked"}
                </span>
              </span>
              <span className="font-display text-sm text-white">
                €{(p.priceCents / 100).toFixed(2)}
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingId(p.id);
                  setAddingKind(null);
                }}
                className="text-[11px] text-gold hover:underline"
              >
                edit
              </button>
              <form action={deleteGymProduct}>
                <input type="hidden" name="product_id" value={p.id} />
                <button
                  type="submit"
                  className="text-[11px] text-red-400 hover:text-red-300 underline"
                >
                  remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {/* Add buttons — one per pass kind we don't already have, so clubs
          don't accidentally duplicate kinds in the common case. */}
      {!open && (
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => {
            const already = products.some((p) => p.kind === k.id);
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => {
                  setAddingKind(k.id);
                  setEditingId(null);
                }}
                className="text-[11px] font-display tracking-wider uppercase border border-border text-white px-3 py-2 rounded-full hover:border-gold"
                title={already ? "Add another" : "Add this pass"}
              >
                + {k.label}
                {already && <span className="ml-1 text-muted">(add another)</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Add / edit form */}
      {open && (
        <form
          action={action}
          key={editingId ?? `new-${addingKind}`}
          className="bg-bg/60 border border-border rounded-xl p-4 space-y-3"
        >
          <p className="font-display text-xs tracking-wider text-gold uppercase">
            {editing ? `Edit · ${editing.title}` : `Add · ${KINDS.find((k) => k.id === addingKind)?.label}`}
          </p>
          {editing && <input type="hidden" name="product_id" value={editing.id} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
                Kind <span className="text-red-400 ml-1">*</span>
              </span>
              <select
                name="kind"
                required
                defaultValue={editing?.kind ?? addingKind ?? "day_pass"}
                className="w-full px-3 py-2 bg-bg border border-border text-white text-sm rounded"
              >
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <Field
              name="title"
              label="Display title"
              defaultValue={
                editing?.title ??
                KINDS.find((k) => k.id === addingKind)?.defaultTitle ??
                ""
              }
              required
            />
            <Field
              name="price_eur"
              label="Price (€)"
              defaultValue={
                editing
                  ? (editing.priceCents / 100).toFixed(2)
                  : ""
              }
              placeholder="15.00"
              required
            />
            <Field
              name="revolut_url"
              label="Revolut payment URL (optional)"
              defaultValue={editing?.revolutUrl ?? ""}
              placeholder="https://revolut.me/…"
            />
            <label className="block sm:col-span-2">
              <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
                Visibility
              </span>
              <select
                name="active"
                defaultValue={String(editing?.active ?? 1)}
                className="w-full px-3 py-2 bg-bg border border-border text-white text-sm rounded"
              >
                <option value="1">Active — shown on your club page</option>
                <option value="0">Hidden — saved but not public</option>
              </select>
            </label>
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
              {pending ? "Saving…" : editing ? "Save changes" : "Add pass"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setAddingKind(null);
              }}
              className="border border-border text-white px-3 py-2 text-xs font-display tracking-wider rounded"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
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
