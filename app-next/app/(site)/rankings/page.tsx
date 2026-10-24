import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { RankMedal } from "@/components/ui/rank-medal";
import Link from "next/link";

export const metadata = {
  title: "National Rankings",
  description: "Published W.U.C.O Ireland national rankings.",
};

export default async function RankingsPage() {
  const rankings = await prisma.ranking.findMany({
    include: { athlete: { include: { passport: true } } },
    orderBy: [{ division: "asc" }, { position: "asc" }],
  });

  const divisions = Array.from(new Set(rankings.map((r) => r.division)));

  return (
    <>
      <PageHeader eyebrow="The road to the top" title="National Rankings">
        Published standings by weight division. Positions are managed by W.U.C.O
        administrators; fight results update records, not ranking positions.
      </PageHeader>
      <Container className="py-10">
        {divisions.length === 0 ? (
          <EmptyState title="No rankings published yet." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {divisions.map((d) => {
              const list = rankings.filter((r) => r.division === d);
              return (
                <div
                  key={d}
                  className="bg-surface border border-border rounded-2xl p-5 overflow-hidden"
                >
                  <h2 className="font-display text-xl tracking-wider text-white mb-3 pb-3 border-b border-border">
                    {d}
                  </h2>
                  <ol className="divide-y divide-border/50">
                    {list.map((r) => (
                      <li key={r.id}>
                        <Link
                          href={`/fighters/${r.athlete.id}`}
                          className={`flex items-center gap-4 py-3 px-2 rounded-xl transition-colors ${
                            r.position <= 3
                              ? "hover:bg-gold/5"
                              : "hover:bg-surface-3"
                          }`}
                        >
                          <RankMedal position={r.position} size="md" />
                          <span className="flex-1 min-w-0">
                            <span className="text-white block font-display tracking-wider">
                              {r.athlete.name}
                            </span>
                            <span className="text-xs text-muted">
                              {r.athlete.wins}–{r.athlete.losses}–{r.athlete.draws}
                              {r.athlete.passport?.fighterNo && (
                                <> · {r.athlete.passport.fighterNo}</>
                              )}
                            </span>
                          </span>
                          <span className="text-gold">↗</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        )}
      </Container>
    </>
  );
}
