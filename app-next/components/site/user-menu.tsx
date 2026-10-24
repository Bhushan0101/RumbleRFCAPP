"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { ChevronDown, LogOut, UserCircle, LifeBuoy } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { sendSupportRequest, type SupportState } from "@/app/actions/support";
import { cn } from "@/lib/cn";

type Props = {
  name: string;
  email?: string | null;
  role?: string;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("") || "W";
}

const initial: SupportState = { ok: false, message: "" };

export function UserMenu({ name, email, role }: Props) {
  const [open, setOpen] = React.useState(false);
  const [supportOpen, setSupportOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDoc);
    return () => window.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          type="button"
          aria-label="Account menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 bg-white/70 hover:bg-white border border-black/10 rounded-full py-1.5 pl-1.5 pr-3 transition-colors"
        >
          <span className="grid place-items-center size-8 rounded-full bg-emerald text-white font-display text-xs tracking-wider">
            {initials(name)}
          </span>
          <span className="hidden md:inline font-display text-xs tracking-wider text-[#07251b]">
            {name.split(" ")[0]}
          </span>
          <ChevronDown
            className={cn(
              "size-3.5 text-[#07251b] transition-transform",
              open && "rotate-180",
            )}
          />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-2 min-w-[240px] bg-white border border-black/10 rounded-xl shadow-2xl overflow-hidden z-50"
          >
            <div className="px-4 py-3 bg-[#f6f5f1] border-b border-black/5">
              <p className="font-display text-sm tracking-wider text-[#07251b]">
                {name}
              </p>
              {email && (
                <p className="text-xs text-neutral-500 truncate mt-0.5">
                  {email}
                </p>
              )}
              {role && (
                <p className="text-[10px] font-display tracking-widest text-emerald uppercase mt-1">
                  {role}
                </p>
              )}
            </div>
            <nav className="py-1">
              <Link
                href="/portal"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#07251b] hover:bg-[#f6f5f1] transition-colors"
                onClick={() => setOpen(false)}
              >
                <UserCircle className="size-4 text-emerald" />
                Dashboard
              </Link>
              {(role === "admin" || role === "ranking_admin") && (
                <Link
                  href="/portal/ranking"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#07251b] hover:bg-[#f6f5f1] transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <UserCircle className="size-4 text-red-500" />
                  Ranking admin
                </Link>
              )}
              <Link
                href="/portal/profile"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#07251b] hover:bg-[#f6f5f1] transition-colors"
                onClick={() => setOpen(false)}
              >
                <UserCircle className="size-4 text-emerald" />
                My profile
              </Link>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setSupportOpen(true);
                }}
                className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-[#07251b] hover:bg-[#f6f5f1] transition-colors"
              >
                <LifeBuoy className="size-4 text-gold" />
                Get support
              </button>
              <form action={signOutAction} className="border-t border-black/5">
                <button
                  type="submit"
                  className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </form>
            </nav>
          </div>
        )}
      </div>

      <SupportDialog open={supportOpen} onClose={() => setSupportOpen(false)} />
    </>
  );
}

function SupportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(sendSupportRequest, initial);
  React.useEffect(() => {
    if (state.ok) {
      const t = setTimeout(onClose, 2500);
      return () => clearTimeout(t);
    }
  }, [state.ok, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl tracking-wider text-[#07251b]">
              Get support
            </h2>
            <p className="text-sm text-neutral-500 mt-1">
              Message the W.U.C.O team. We'll reply to the email on your account.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {state.message && (
          <p
            className={cn(
              "mt-4 p-3 rounded-lg text-sm border",
              state.ok
                ? "bg-emerald/10 text-emerald-ink border-emerald/30"
                : "bg-red-50 text-red-700 border-red-200",
            )}
          >
            {state.message}
          </p>
        )}
        <form action={action} className="mt-5 space-y-3">
          <label className="block">
            <span className="font-display text-[11px] tracking-wider text-neutral-600 uppercase block mb-1.5">
              Subject
            </span>
            <input
              name="subject"
              required
              maxLength={200}
              className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded-lg text-[#07251b] focus:border-emerald outline-none"
            />
          </label>
          <label className="block">
            <span className="font-display text-[11px] tracking-wider text-neutral-600 uppercase block mb-1.5">
              Message
            </span>
            <textarea
              name="message"
              required
              rows={5}
              maxLength={4000}
              className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded-lg text-[#07251b] focus:border-emerald outline-none"
            />
          </label>
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="px-5 py-2.5 rounded-full bg-emerald text-white font-display font-bold text-xs tracking-wider uppercase hover:bg-emerald-hi disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send message →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
