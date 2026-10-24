"use client";

import * as React from "react";
import Link from "next/link";
import { Search, User, ChevronDown, Menu, X } from "lucide-react";
import { BrandLockup } from "./brand-lockup";
import { Container } from "@/components/ui/container";
import { NAV } from "./nav-data";
import { UserMenu } from "./user-menu";
import { cn } from "@/lib/cn";

type Props = {
  user: {
    name: string;
    email: string | null;
    role: string | undefined;
  } | null;
};

export function SiteHeaderClient({ user }: Props) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [mobileExpanded, setMobileExpanded] = React.useState<string | null>(null);

  return (
    <>
      <header
        className="sticky top-0 z-50 border-b border-black/5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
        style={{
          background:
            "linear-gradient(180deg, #f6f5f1 0%, #ebe8dd 55%, #cfc9b4 100%)",
        }}
      >
        <Container className="flex items-center gap-7 py-3">
          <div className="flex-none mr-auto">
            <BrandLockup size="md" variant="light" />
          </div>

          {/* Desktop nav */}
          <nav
            aria-label="Primary"
            className="hidden lg:flex flex-1 justify-center"
          >
            <ul className="flex items-center gap-7">
              {NAV.map((item) => (
                <li key={item.label} className="relative group">
                  <Link
                    href={item.href}
                    className="flex items-center gap-1 py-3 font-display font-semibold text-sm text-[#07251b] hover:text-emerald transition-colors"
                  >
                    {item.label}
                    {item.children && (
                      <ChevronDown className="size-3 opacity-70 group-hover:rotate-180 transition-transform" />
                    )}
                  </Link>
                  {item.children && (
                    <div
                      role="menu"
                      className="absolute top-full left-0 min-w-[220px] bg-white/95 backdrop-blur border border-black/10 rounded-xl shadow-xl py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible focus-within:opacity-100 focus-within:visible transition-all overflow-hidden"
                    >
                      {item.children.map((c) => (
                        <Link
                          key={c.href + c.label}
                          href={c.href}
                          className="block px-5 py-2.5 text-sm text-[#07251b] hover:bg-[#f1efe6] hover:text-emerald transition-colors"
                        >
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Search"
              className="hidden sm:grid place-items-center size-10 border border-black/10 bg-white/60 text-[#07251b] hover:border-emerald hover:text-emerald rounded-full transition-colors"
            >
              <Search className="size-4" />
            </button>
            {user ? (
              <UserMenu name={user.name} email={user.email} role={user.role} />
            ) : (
              <Link
                href="/portal/sign-in"
                className="inline-flex items-center gap-2 bg-emerald text-white px-5 py-2.5 font-display font-bold text-xs tracking-wider uppercase rounded-full hover:bg-emerald-hi shadow-sm transition-colors"
              >
                <User className="size-3.5" />
                <span className="hidden sm:inline">Member Login</span>
                <span className="sm:hidden">Login</span>
              </Link>
            )}
            <button
              type="button"
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={mobileOpen}
              className="lg:hidden grid place-items-center size-10 border border-black/10 text-[#07251b] rounded-full bg-white/60"
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </Container>

        {mobileOpen && (
          <nav
            aria-label="Primary mobile"
            className="lg:hidden border-t border-black/10 bg-[#f6f5f1]"
          >
            <Container className="py-3">
              <ul className="flex flex-col">
                {NAV.map((item) => (
                  <li
                    key={item.label}
                    className="border-b border-black/10 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <Link
                        href={item.href}
                        className="flex-1 py-3 font-display font-semibold text-sm text-[#07251b]"
                        onClick={() => setMobileOpen(false)}
                      >
                        {item.label}
                      </Link>
                      {item.children && (
                        <button
                          type="button"
                          aria-expanded={mobileExpanded === item.label}
                          aria-label={`Expand ${item.label}`}
                          onClick={() =>
                            setMobileExpanded((p) =>
                              p === item.label ? null : item.label,
                            )
                          }
                          className="p-2 text-neutral-500"
                        >
                          <ChevronDown
                            className={cn(
                              "size-4 transition-transform",
                              mobileExpanded === item.label && "rotate-180",
                            )}
                          />
                        </button>
                      )}
                    </div>
                    {item.children && mobileExpanded === item.label && (
                      <ul className="pb-3 pl-4">
                        {item.children.map((c) => (
                          <li key={c.href + c.label}>
                            <Link
                              href={c.href}
                              className="block py-2 text-sm text-[#07251b]"
                              onClick={() => setMobileOpen(false)}
                            >
                              {c.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
                {!user && (
                  <li className="pt-3">
                    <Link
                      href="/portal/sign-in"
                      className="w-full inline-flex items-center justify-center gap-2 bg-emerald text-white px-4 py-3 font-display font-bold text-xs tracking-wider uppercase rounded-full"
                    >
                      <User className="size-4" /> Member Login
                    </Link>
                  </li>
                )}
              </ul>
            </Container>
          </nav>
        )}
      </header>
      {/* Fade transition strip from cream to dark hero */}
      <div
        aria-hidden
        className="h-6 -mt-px"
        style={{
          background:
            "linear-gradient(180deg, #cfc9b4 0%, #807c6b 40%, #2a3330 70%, #080D0E 100%)",
        }}
      />
    </>
  );
}
