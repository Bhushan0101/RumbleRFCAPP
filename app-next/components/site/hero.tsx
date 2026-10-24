import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/container";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#07251b]">
      <Image
        src="/brand/arena.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[center_45%]"
      />
      {/* overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#07251bea] via-[#07251b7a] to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#07251bcc] via-transparent to-transparent" />

      <Container className="relative z-10 py-24 lg:py-32 text-center">
        <p className="font-display text-xs tracking-[0.5em] text-white uppercase mb-2">
          WORLD UNITED COMBAT ORGANISATION
        </p>
        <h1 className="font-display font-black text-white tracking-wider leading-none">
          <span className="block text-[clamp(90px,13vw,180px)]">WUCO</span>
          <span className="relative inline-block my-6 font-display text-xs tracking-[0.4em] text-gold px-6">
            <span className="absolute left-[-18px] top-1/2 w-4 h-px bg-gold" />
            IRELAND
            <span className="absolute right-[-18px] top-1/2 w-4 h-px bg-gold" />
          </span>
          <span className="block text-[clamp(28px,4vw,54px)] font-black">
            THE HOME OF IRISH<br />
            <em className="not-italic text-gold">COMBAT SPORTS</em>
          </span>
        </h1>
        <p className="mt-7 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] tracking-[0.35em] text-white/90 uppercase">
          <span>ONE FEDERATION</span>
          <span className="text-white/30">|</span>
          <span>OFFICIAL RECORDS</span>
          <span className="text-white/30">|</span>
          <span>NATIONAL RANKINGS</span>
          <span className="text-white/30">|</span>
          <span>REAL OPPORTUNITIES</span>
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/portal"
            className="inline-flex items-center gap-3 bg-emerald text-white border border-emerald px-8 py-4 font-display font-bold text-xs tracking-[0.2em] uppercase hover:bg-emerald-hi rounded-full shadow-lg shadow-emerald/30"
          >
            JOIN WUCO <span>→</span>
          </Link>
          <Link
            href="/rankings"
            className="inline-flex items-center gap-3 border border-gold text-white px-8 py-4 font-display font-bold text-xs tracking-[0.2em] uppercase hover:bg-gold hover:text-bg rounded-full"
          >
            VIEW RANKINGS <span>→</span>
          </Link>
        </div>
      </Container>
    </section>
  );
}
