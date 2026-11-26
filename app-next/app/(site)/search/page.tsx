import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { divisionDisplayName } from "@/lib/divisions";
import { martialArtName } from "@/lib/martial-arts";

export const metadata = { title: "Search" };

const RESULT_LIMIT = 15;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const term = (q ?? "").trim();

  type Fighter = {
    id: number;
    name: string;
    division: string;
    martialArt: string;
    wins: number;
    losses: number;
    draws: number;
    fighterNo: string | null;
  };
  type Club = { id: number; name: string; slug: string | null; city: string };
  type Event = { id: number; title: string; city: string | null; startsAt: string | null };

  let fighters: Fighter[] = [];
  let clubs: Club[] = [];
  let events: Event[] = [];

  if (term.length > 0) {
    const [f, c, e] = await Promise.all([
      prisma.athlete.findMany({
        where: {
          profile: { approvalStatus: "approved" },
          OR: [
            { name: { contains: term } },
            { nickname: { contains: term } },
            { passport: { fighterNo: { contains: term } } },
          ],
        },
        include: { passport: true },
        orderBy: { name: "asc" },
        take: RESULT_LIMIT,
      }),
      prisma.gym.findMany({
        where: {
          status: "active",
          OR: [
            { name: { contains: term } },
            { city: { contains: term } },
          ],
        },
        select: { id: true, name: true, slug: true, city: true },
        orderBy: { name: "asc" },
        take: RESULT_LIMIT,
      }),
      prisma.event.findMany({
        where: {
          OR: [
            { title: { contains: term } },
            { subtitle: { contains: term } },
            { city: { contains: term } },
            { venue: { contains: term } },
          ],
        },
        select: { id: true, title: true, city: true, startsAt: true },
        orderBy: { startsAt: "desc" },
        take: RESULT_LIMIT,
      }),
    ]);
    fighters = f.map((a) => ({
      id: a.id,
      name: a.name,
      division: a.division ?? "",
      martialArt: a.martialArt ?? "",
      wins: a.wins,
      losses: a.losses,
      draws: a.draws,
      fighterNo: a.passport?.fighterNo ?? null,
    }));
    clubs = c;
    events = e;
  }

  const totalResults = fighters.length + clubs.length + events.length;

  return (
    <>
      <PageHeader eyebrow="W.U.C.O" title="Search">
        Find fighters, clubs and events across the W.U.C.O Ireland registry.
      </PageHeader>
      <Container className="py-10 space-y-8">
        <form
          method="get"
          className="bg-surface border border-border rounded-xl p-4 md:p-5 flex flex-col sm:flex-row gap-3"
        >
          <input
            name="q"
            type="search"
            defaultValue={term}
            placeholder="Search fighters, clubs, events…"
            autoFocus
            className="flex-1 px-4 py-3 bg-bg border border-border text-white rounded-lg focus:border-gold outline-none"
          />
          <button
            type="submit"
            className="bg-gold text-bg px-6 py-3 font-display font-bold text-xs tracking-wider uppercase rounded-full hover:bg-gold-hi"
          >
            Search
          </button>
        </form>

        {term.length === 0 ? (
          <EmptyState
            title="Type something to start searching."
            description="Try a fighter's name, a fighter number (IRL-000NNN), a club, or an event."
          />
        ) : totalResults === 0 ? (
          <EmptyState
            title={`No matches for “${term}”.`}
            description="Try a shorter word or check spelling."
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <ResultColumn title={`Fighters (${fighters.length})`}>
              {fighters.length === 0 ? (
                <EmptyColumn label="No fighters match." />
              ) : (
                <ul className="divide-y divide-border/60">
                  {fighters.map((f) => (
                    <li key={f.id}>
                      <Link
                        href={`/fighters/${f.id}`}
                        className="flex flex-col py-3 hover:text-gold"
                      >
                        <span className="font-display tracking-wider text-white">
                          {f.name}
                        </span>
                        <span className="text-[11px] text-muted">
                          {f.fighterNo ?? "—"} · {martialArtName(f.martialArt) || "—"} ·{" "}
                          {divisionDisplayName(null, f.division) || "—"} ·{" "}
                          {f.wins}-{f.losses}-{f.draws}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </ResultColumn>

            <ResultColumn title={`Clubs (${clubs.length})`}>
              {clubs.length === 0 ? (
                <EmptyColumn label="No clubs match." />
              ) : (
                <ul className="divide-y divide-border/60">
                  {clubs.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={c.slug ? `/clubs/${c.slug}` : "/clubs"}
                        className="flex flex-col py-3 hover:text-gold"
                      >
                        <span className="font-display tracking-wider text-white">
                          {c.name}
                        </span>
                        {c.city && (
                          <span className="text-[11px] text-muted">{c.city}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </ResultColumn>

            <ResultColumn title={`Events (${events.length})`}>
              {events.length === 0 ? (
                <EmptyColumn label="No events match." />
              ) : (
                <ul className="divide-y divide-border/60">
                  {events.map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/events/${e.id}`}
                        className="flex flex-col py-3 hover:text-gold"
                      >
                        <span className="font-display tracking-wider text-white">
                          {e.title}
                        </span>
                        <span className="text-[11px] text-muted">
                          {e.startsAt ?? "Date TBA"}
                          {e.city ? ` · ${e.city}` : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </ResultColumn>
          </div>
        )}
      </Container>
    </>
  );
}

function ResultColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface border border-border rounded-xl p-5">
      <h2 className="font-display text-lg text-white tracking-wider mb-3 pb-3 border-b border-border">
        {title}
      </h2>
      {children}
    </section>
  );
}

function EmptyColumn({ label }: { label: string }) {
  return <p className="text-xs text-muted">{label}</p>;
}
