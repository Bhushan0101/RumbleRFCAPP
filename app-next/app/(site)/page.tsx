import { Hero } from "@/components/site/hero";
import { QuickServices } from "@/components/site/quick-services";
import { RankingsPanel, type RankingRow } from "@/components/site/rankings-panel";
import { EventsPanel } from "@/components/site/events-panel";
import { ActionCards } from "@/components/site/action-cards";
import { StatsBar } from "@/components/site/stats-bar";
import { Container } from "@/components/ui/container";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const rows = await prisma.ranking.findMany({
    include: { athlete: { include: { passport: true } } },
    orderBy: [{ division: "asc" }, { position: "asc" }],
  });
  const rankings: RankingRow[] = rows.map((r) => ({
    id: r.id,
    position: r.position,
    division: r.division,
    athleteId: r.athleteId,
    name: r.athlete.name,
    martialArt: r.athlete.martialArt,
    classCode: r.athlete.classCode,
    gender: r.athlete.gender,
    wins: r.athlete.wins,
    losses: r.athlete.losses,
    draws: r.athlete.draws,
    fighterNo: r.athlete.passport?.fighterNo ?? null,
  }));

  return (
    <>
      <Hero />
      <QuickServices />
      <section className="bg-bg py-10">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <RankingsPanel rankings={rankings} />
            <EventsPanel />
          </div>
        </Container>
      </section>
      <ActionCards />
      <StatsBar />
    </>
  );
}
