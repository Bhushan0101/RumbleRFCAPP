import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  RankingsFullTable,
  type RankingsFullRow,
} from "@/components/site/rankings-full-table";

export const metadata = {
  title: "National Rankings — shared view",
  robots: { index: false, follow: false },
};

export default async function SharedRankingsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const share = await prisma.rankingShareToken.findUnique({
    where: { token },
    include: { user: { select: { name: true, email: true } } },
  });

  const nowSec = Math.floor(Date.now() / 1000);
  const expired = !share || share.expiresAt < nowSec || share.revokedAt != null;

  if (!share || expired) {
    return (
      <>
        <PageHeader
          eyebrow="National rankings"
          title={share ? "Link expired" : "Link not found"}
        >
          {share
            ? "This shared rankings link is no longer valid. Links are good for 24 hours — ask the W.U.C.O admin for a fresh one."
            : "This shared rankings link doesn't look right. Links are issued by a W.U.C.O admin and expire after 24 hours."}
        </PageHeader>
        <Container className="py-10">
          <EmptyState
            title="Request a new link"
            description="Sign in to the member portal and request access from the rankings page."
          />
          <div className="mt-6">
            <Link
              href="/rankings"
              className="inline-block text-xs text-gold font-display tracking-wider underline"
            >
              ← Back to public rankings
            </Link>
          </div>
        </Container>
      </>
    );
  }

  const rankings = await prisma.ranking.findMany({
    where: share.scope === "full" ? {} : { division: share.scope },
    include: {
      athlete: {
        include: { passport: true, disciplines: true },
      },
    },
    orderBy: [{ division: "asc" }, { position: "asc" }],
  });

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

  const expiresAt = new Date(share.expiresAt * 1000);
  const hoursLeft = Math.max(0, Math.floor((share.expiresAt - nowSec) / 3600));
  const minutesLeft = Math.max(
    0,
    Math.floor(((share.expiresAt - nowSec) % 3600) / 60),
  );

  return (
    <>
      <PageHeader eyebrow="Shared view" title="National Rankings">
        A W.U.C.O admin has shared the full national rankings with{" "}
        {share.user.name}. This link expires on{" "}
        <time dateTime={expiresAt.toISOString()}>{expiresAt.toUTCString()}</time>
        {" "}· {hoursLeft}h {minutesLeft}m remaining.
      </PageHeader>
      <Container className="py-10">
        {rows.length === 0 ? (
          <EmptyState title="No rankings published yet." />
        ) : (
          <RankingsFullTable rows={rows} signedIn canSeeFull />
        )}
      </Container>
    </>
  );
}
