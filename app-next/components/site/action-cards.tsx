import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/ui/container";

type Card = {
  title: string;
  description: string;
  cta: string;
  href: string;
  photoPos: string;
};

const CARDS: Card[] = [
  {
    title: "JOIN AS A FIGHTER",
    description:
      "Register, get your WUCO number and start building your official fight record.",
    cta: "REGISTER NOW",
    href: "/register",
    photoPos: "60% 30%",
  },
  {
    title: "REGISTER YOUR CLUB",
    description:
      "Join WUCO Ireland and become part of the national combat sports network.",
    cta: "CLUB REGISTRATION",
    href: "/clubs/join",
    photoPos: "30% 60%",
  },
  {
    title: "BECOME A PROMOTER",
    description:
      "Work with WUCO to organise sanctioned events and grow Irish combat sports.",
    cta: "PROMOTER APPLICATION",
    href: "/promoters/join",
    photoPos: "85% 40%",
  },
  {
    title: "FIGHT RECORDS",
    description:
      "Explore verified fighter records, competition results and fight history.",
    cta: "SEARCH FIGHTERS",
    href: "/fighters",
    photoPos: "15% 70%",
  },
];

export function ActionCards() {
  return (
    <section className="bg-bg py-10">
      <Container>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CARDS.map((c) => (
            <div
              key={c.title}
              className="flex flex-col bg-surface border border-border overflow-hidden group rounded-2xl"
            >
              <div className="relative h-40 overflow-hidden">
                <Image
                  src="/brand/arena.webp"
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  style={{ objectPosition: c.photoPos }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
              </div>
              <div className="flex-1 flex flex-col gap-3 p-5">
                <h3 className="font-display text-xl text-white tracking-wider">
                  {c.title}
                </h3>
                <p className="text-xs text-muted leading-relaxed flex-1">
                  {c.description}
                </p>
                <Link
                  href={c.href}
                  className="inline-flex items-center justify-center gap-2 bg-gold text-bg py-3 px-4 font-display font-bold text-[11px] tracking-wider uppercase hover:bg-gold-hi rounded-full"
                >
                  {c.cta} →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
