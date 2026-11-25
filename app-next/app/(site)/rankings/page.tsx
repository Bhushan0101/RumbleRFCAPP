import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  RankingsFullTable,
  type RankingsFullRow,
} from "@/components/site/rankings-full-table";

export const metadata = {
  title: "National Rankings",
  description: "Published W.U.C.O Ireland national rankings.",
};

export default async function RankingsPage() {
  const [session, rankings] = await Promise.all([
    auth(),
    prisma.ranking.findMany({
      include: {
        athlete: {
          include: { passport: true, disciplines: true },
        },
      },
      orderBy: [{ division: "asc" }, { position: "asc" }],
    }),
  ]);

  const role = session?.user?.role ?? "";
  const signedIn = !!session?.user;
  // Promoters, admins and ranking admins can see the full table.
  // Fighters see the top 10 per division with a request button.
  const canSeeFull = role === "promoter" || role === "admin" || role === "ranking_admin";

  const rows: RankingsFullRow[] = rankings.map((r) => ({
    id: r.id,
    position: r.position,
    division: r.division,
    athleteId: r.athlete.id,
    name: r.athlete.name,
    wins: r.athlete.wins,
    losses: r.athlete.losses,
    draws: r.athlete.draws,
    fighterNo: r.athlete.passport?.fighterNo ?? null,
    disciplines: r.athlete.disciplines.map((d) => d.martialArt),
  }));

  return (
    <>
      <PageHeader eyebrow="The road to the top" title="National Rankings">
        Published standings by weight division. Positions are managed by W.U.C.O
        administrators; fight results update records, not ranking positions.
      </PageHeader>
      <Container className="py-10">
        {rows.length === 0 ? (
          <EmptyState title="No rankings published yet." />
        ) : (
          <RankingsFullTable
            rows={rows}
            signedIn={signedIn}
            canSeeFull={canSeeFull}
          />
        )}
      </Container>
    </>
  );
}
