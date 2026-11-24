"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  submitVerificationRequest,
  type VerificationState,
} from "@/app/actions/profile";

const initial: VerificationState = { ok: false, message: "" };

export type VerificationItem = {
  id: number;
  body: string;
  status: "pending" | "verified" | "rejected";
  adminNote: string;
  createdAt: string;
  verifiedAt: string | null;
};

export function VerificationRequestsPanel({
  items,
}: {
  items: VerificationItem[];
}) {
  const [state, action, pending] = useActionState(submitVerificationRequest, initial);
  const [body, setBody] = React.useState("");

  const hasPending = items.some((i) => i.status === "pending");

  // When submit succeeds, clear the textarea.
  React.useEffect(() => {
    if (state.ok) setBody("");
  }, [state.ok]);

  return (
    <section className="bg-surface border border-border rounded-2xl p-6">
      <h2 className="font-display text-xl text-white tracking-wider">
        Verification requests
      </h2>
      <p className="text-xs text-muted mt-1 mb-5">
        Submit your fight history and discipline details here for W.U.C.O admins
        to verify. Only you and the admin team can see these submissions.
      </p>

      {items.length > 0 && (
        <ul className="space-y-3 mb-6">
          {items.map((it) => (
            <li
              key={it.id}
              className={`rounded-lg border p-3 md:p-4 ${
                it.status === "verified"
                  ? "border-emerald/50 bg-emerald/5"
                  : it.status === "rejected"
                    ? "border-red-500/40 bg-red-500/5"
                    : "border-gold/40 bg-gold/5"
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <StatusBadge status={it.status} />
                <span className="text-[10px] text-muted">
                  {new Date(it.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-white whitespace-pre-wrap">{it.body}</p>
              {it.adminNote && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <p className="text-[10px] font-display tracking-wider text-gold uppercase mb-1">
                    Admin note
                  </p>
                  <p className="text-xs text-[#cfe3d8] whitespace-pre-wrap">
                    {it.adminNote}
                  </p>
                </div>
              )}
              {it.status === "verified" && (
                <p className="mt-2 text-[10px] text-emerald font-display tracking-wider">
                  Locked. Submit a new request below to verify another entry.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {hasPending ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">
          Your request is awaiting review. You can submit another once it&apos;s
          been actioned.
        </div>
      ) : (
        <form action={action} className="space-y-3">
          <label className="block">
            <span className="block font-display text-xs tracking-wider text-gold uppercase mb-1.5">
              New submission
            </span>
            <textarea
              name="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              required
              minLength={10}
              maxLength={4000}
              placeholder="List your disciplines and fight history — events, opponents, dates, results. Anything that helps admin verify you."
              className="w-full px-3 py-2 bg-bg border border-border text-white text-sm focus:border-gold outline-none rounded-lg"
            />
          </label>
          {state.message && (
            <p
              className={`text-xs ${
                state.ok ? "text-emerald" : "text-red-400"
              }`}
            >
              {state.message}
            </p>
          )}
          <button
            type="submit"
            disabled={pending || body.trim().length < 10}
            className="bg-emerald text-white px-5 py-2.5 font-display font-bold text-xs tracking-wider uppercase rounded-full hover:bg-emerald-hi disabled:opacity-50"
          >
            {pending
              ? "Submitting…"
              : items.some((i) => i.status === "verified")
                ? "Submit another for verification"
                : "Submit for verification"}
          </button>
        </form>
      )}
    </section>
  );
}

function StatusBadge({
  status,
}: {
  status: "pending" | "verified" | "rejected";
}) {
  const cfg: Record<typeof status, { label: string; bg: string; fg: string; border: string }> = {
    pending: {
      label: "PENDING REVIEW",
      bg: "rgba(216,184,117,0.15)",
      fg: "#D8B875",
      border: "rgba(216,184,117,0.5)",
    },
    verified: {
      label: "VERIFIED",
      bg: "rgba(22,155,98,0.15)",
      fg: "#6ee7b7",
      border: "rgba(22,155,98,0.5)",
    },
    rejected: {
      label: "NEEDS UPDATE",
      bg: "rgba(220,38,38,0.15)",
      fg: "#f87171",
      border: "rgba(220,38,38,0.5)",
    },
  };
  const c = cfg[status];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-display tracking-wider"
      style={{ background: c.bg, color: c.fg, borderColor: c.border }}
    >
      {c.label}
    </span>
  );
}
