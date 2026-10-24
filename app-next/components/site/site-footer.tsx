import Link from "next/link";
import { Container } from "@/components/ui/container";
import { BrandLockup } from "./brand-lockup";

export function SiteFooter() {
  return (
    <footer className="bg-[#060a0b] border-t border-border text-white mt-auto">
      <Container className="py-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-white/10">
          <BrandLockup size="lg" variant="dark" />
          <p className="font-display text-2xl uppercase leading-tight tracking-wide">
            THE HOME OF IRISH<br />COMBAT SPORTS.
          </p>
          <Link
            href="/portal"
            className="inline-flex items-center gap-3 border border-white/40 px-6 py-3 font-display font-bold text-xs tracking-wider uppercase hover:border-gold hover:text-gold"
          >
            Join WUCO ↗
          </Link>
        </div>
        <div className="flex flex-col md:flex-row justify-between gap-4 pt-6 text-xs text-muted-2">
          <span>© 2026 W.U.C.O Ireland · All rights reserved</span>
          <div className="flex gap-5">
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
          <span>Sample athletes, events & imagery</span>
        </div>
      </Container>
    </footer>
  );
}
