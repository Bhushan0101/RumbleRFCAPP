import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = {
  title: "Clubs",
  description: "Affiliated W.U.C.O Ireland combat sports clubs.",
};

export default async function ClubsPage() {
  const gyms = await prisma.gym.findMany({
    where: { status: "active" },
    include: { _count: { select: { fighters: true, classes: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader eyebrow="National structure" title="Clubs">
        Affiliated combat sports clubs across Ireland. Each club runs its own
        timetable, prices and class bookings via its public page.
      </PageHeader>
      <Container className="py-10">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted">{gyms.length} active clubs</p>
          <Link
            href="/clubs/join"
            className="bg-gold text-bg px-5 py-2.5 font-display font-bold text-xs tracking-wider hover:bg-gold-hi"
          >
            JOIN WUCO AS A CLUB →
          </Link>
        </div>
        {gyms.length === 0 ? (
          <EmptyState
            title="No clubs yet."
            description="Clubs you approve will appear here once onboarding is complete."
          />
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {gyms.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/clubs/${g.slug}`}
                  className="group block bg-surface border border-border p-5 h-full hover:border-gold transition-colors"
                >
                  <h3 className="font-display text-xl text-white tracking-wider">
                    {g.name}
                  </h3>
                  <p className="text-xs text-muted mt-1">{g.city}</p>
                  <p className="text-sm text-muted mt-3 line-clamp-3">
                    {g.about || "An affiliated W.U.C.O club."}
                  </p>
                  <p className="text-xs text-gold mt-4 font-display tracking-wider">
                    {g._count.classes} classes · {g._count.fighters} members ↗
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}
