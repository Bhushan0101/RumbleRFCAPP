import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@/components/ui/empty-state";

const CLASS_LABEL: Record<string, string> = {
  J: "J-Class (U18)",
  N: "N-Class (≤5 fights)",
  L: "L-Class (Learning)",
  C: "C-Class (No shin pads)",
  B: "B-Class (Debut pro)",
  A: "A-Class (Seasoned pro)",
};

export const metadata = {
  title: "Fighters",
  description: "The W.U.C.O Ireland fighter directory.",
};

export default async function FightersPage() {
  const fighters = await prisma.athlete.findMany({
    where: { profile: { approvalStatus: "approved" } },
    include: { passport: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader eyebrow="The W.U.C.O roster" title="Fighters">
        Every athlete has a story. Browse approved fighters across weight
        divisions, martial arts and experience classes.
      </PageHeader>
      <Container className="py-10">
        {fighters.length === 0 ? (
          <EmptyState
            title="No approved fighters yet."
            description="Once applications are approved they'll appear here."
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {fighters.map((f) => (
              <Link
                key={f.id}
                href={`/fighters/${f.id}`}
                className="group bg-surface border border-border overflow-hidden"
              >
                <div className="aspect-[4/5] bg-surface-3 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" />
                  <div className="absolute left-4 right-4 bottom-4">
                    <p className="font-display text-[10px] tracking-wider text-gold">
                      {f.passport?.fighterNo ?? "UNRANKED"}
                    </p>
                    <h3 className="font-display text-xl text-white tracking-wider mt-1">
                      {f.name}
                    </h3>
                  </div>
                </div>
                <div className="p-4 flex flex-col gap-1 text-xs text-muted">
                  <span>
                    <span className="text-white">{f.martialArt || "—"}</span>
                    {" · "}
                    {CLASS_LABEL[f.classCode ?? ""] ?? "No class"}
                  </span>
                  <span>
                    {f.division} · {f.country}
                  </span>
                  <span className="text-white font-display tracking-wider mt-1">
                    {f.wins}–{f.losses}–{f.draws}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Container>
    </>
  );
}
