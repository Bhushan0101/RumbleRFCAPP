"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X, Trophy, Users, Building2, CalendarDays, UserPlus } from "lucide-react";

const QUICK_LINKS = [
  { href: "/rankings", label: "National rankings", Icon: Trophy },
  { href: "/fighters", label: "Browse fighters", Icon: Users },
  { href: "/clubs", label: "Clubs", Icon: Building2 },
  { href: "/events", label: "Events", Icon: CalendarDays },
  { href: "/register", label: "Register as a fighter", Icon: UserPlus },
] as const;

export function HeaderSearch() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Prevent body scroll when the mobile sheet is open.
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  React.useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Search"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid place-items-center size-10 border border-black/10 bg-white/60 text-[#07251b] hover:border-emerald hover:text-emerald rounded-full transition-colors"
      >
        <Search className="size-4" />
      </button>

      {open && (
        <>
          {/* Mobile backdrop — only shown below sm. */}
          <div
            aria-hidden
            className="sm:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setOpen(false)}
          />

          <div
            role="dialog"
            aria-label="Search"
            className={[
              // Mobile: full-width sheet pinned under the header.
              "fixed left-3 right-3 top-[64px] z-50",
              // Desktop: anchored popover from the button.
              "sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[380px]",
              "bg-white border border-black/10 rounded-xl shadow-xl overflow-hidden max-h-[80vh] overflow-y-auto",
            ].join(" ")}
          >
            <form
              onSubmit={submit}
              className="p-3 border-b border-black/10 bg-[#f6f5f1] flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#07251b]/50" />
                <input
                  ref={inputRef}
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search fighters, clubs, events…"
                  aria-label="Search WUCO"
                  className="w-full pl-9 pr-9 py-2.5 text-sm bg-white border border-black/10 rounded-lg text-[#07251b] placeholder:text-[#07251b]/40 focus:outline-none focus:border-emerald"
                />
                {q && (
                  <button
                    type="button"
                    aria-label="Clear"
                    onClick={() => {
                      setQ("");
                      inputRef.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#07251b]/50 hover:text-[#07251b]"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={!q.trim()}
                className="bg-emerald text-white px-4 py-2.5 font-display font-bold text-[11px] tracking-wider uppercase rounded-full hover:bg-emerald-hi disabled:opacity-50 whitespace-nowrap self-stretch sm:self-auto"
              >
                Search →
              </button>
            </form>
            <ul className="py-1.5">
              <li className="px-4 pt-2 pb-1">
                <p className="font-display text-[10px] tracking-wider text-[#07251b]/50 uppercase">
                  Jump to
                </p>
              </li>
              {QUICK_LINKS.map(({ href, label, Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#07251b] hover:bg-[#f1efe6] hover:text-emerald transition-colors"
                  >
                    <Icon className="size-4 text-emerald flex-shrink-0" />
                    <span className="whitespace-nowrap">{label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
