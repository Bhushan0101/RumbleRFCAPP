import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ShareRankingsModal,
  type RankingRequestForModal,
} from "@/components/site/share-rankings-modal";

export const metadata = { title: "Admin · Ranking requests" };
export const dynamic = "force-dynamic";

export default async function AdminRankingRequestsPage() {
  const session = await auth();
  if (
    session?.user?.role !== "admin" &&
    session?.user?.role !== "ranking_admin"
  ) {
    redirect("/portal/sign-in");
  }

  const [pending, resolved] = await Promise.all([
    prisma.rankingAccessRequest.findMany({
      where: { status: "pending" },
      include: {
        user: {
          include: {
            fighterProfile: {
              include: { athlete: { include: { passport: true } }, gym: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.rankingAccessRequest.findMany({
      where: { status: { in: ["resolved", "rejected"] } },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { resolvedAt: "desc" },
      take: 20,
    }),
  ]);

  // Resolve a shared token's expiry so we can show "expires in …" next to it.
  const tokenIds = resolved.map((r) => r.shareToken).filter(Boolean) as string[];
  const tokens = tokenIds.length
    ? await prisma.rankingShareToken.findMany({
        where: { token: { in: tokenIds } },
        select: { token: true, expiresAt: true },
      })
    : [];
  const tokenExpiry = new Map(tokens.map((t) => [t.token, t.expiresAt]));
  const nowSec = Math.floor(Date.now() / 1000);

  // Shape data for the review modal.
  const modalRequests: RankingRequestForModal[] = pending.map((r) => {
    const a = r.user.fighterProfile?.athlete;
    return {
      id: r.id,
      requesterName: r.user.name,
      requesterEmail: r.user.email,
      fighterNo: a?.passport?.fighterNo ?? null,
      currentDivision: a?.division ?? "",
      primaryDiscipline: a?.martialArt ?? "",
      gymName: r.user.fighterProfile?.gym?.name ?? null,
      note: r.note,
      createdAt: r.createdAt.toISOString().slice(0, 10),
    };
  });

  return (
    <>
      <PageHeader eyebrow="Administrator" title="Ranking share requests">
        Fighters asking to see rankings outside their own division. Share
        issues a 24-hour link emailed to the requester — no account change.
      </PageHeader>
      <Container className="py-10 space-y-6">
        <Link
          href="/portal"
          className="text-xs text-gold font-display tracking-wider"
        >
          ← Back to dashboard
        </Link>

        <section className="bg-surface border border-gold/40 rounded-xl p-5">
          <header className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="font-display text-lg text-white tracking-wider">
              Pending
            </h2>
            <span className="text-xs text-muted">
              {pending.length === 0
                ? "No one waiting"
                : `${pending.length} awaiting a share`}
            </span>
          </header>
          {pending.length === 0 ? (
            <p className="text-xs text-muted">
              You&apos;ll see fighter requests here when they ask for broader
              rankings access.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {pending.map((r) => {
                const a = r.user.fighterProfile?.athlete;
                const gym = r.user.fighterProfile?.gym;
                return (
                  <li key={r.id} className="py-3 flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm text-white tracking-wider">
                        {r.user.name}
                        {a?.passport?.fighterNo && (
                          <span className="ml-2 text-xs text-gold">
                            {a.passport.fighterNo}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">
                        {r.user.email}
                        {a?.division && ` · ${a.division}`}
                        {a?.martialArt && ` · ${a.martialArt}`}
                        {gym?.name && ` · ${gym.name}`}
                      </p>
                      {r.note && (
                        <pre className="whitespace-pre-wrap text-[11px] text-white/80 mt-1">
                          {r.note}
                        </pre>
                      )}
                      <p className="text-[10px] text-muted mt-1">
                        asked {r.createdAt.toISOString().slice(0, 10)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/portal/admin/ranking-requests?open=${r.id}`}
                        className="bg-emerald text-white px-3 py-1.5 text-xs font-display tracking-wider hover:bg-emerald-hi rounded"
                        title="Open review modal"
                      >
                        REVIEW →
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="bg-surface border border-border rounded-xl p-5">
          <header className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="font-display text-lg text-white tracking-wider">
              Recently resolved
            </h2>
            <span className="text-xs text-muted">
              Last {resolved.length}
            </span>
          </header>
          {resolved.length === 0 ? (
            <EmptyState title="Nothing resolved yet." />
          ) : (
            <ul className="divide-y divide-border/60">
              {resolved.map((r) => {
                const exp = r.shareToken ? tokenExpiry.get(r.shareToken) : null;
                const stillLive = exp != null && exp > nowSec;
                return (
                  <li key={r.id} className="py-2 flex flex-wrap items-center gap-3 text-sm">
                    <span className="flex-1 min-w-0 text-white">
                      {r.user.name}
                      <span className="block text-[11px] text-muted">
                        {r.user.email} ·{" "}
                        <span
                          className={
                            r.status === "resolved"
                              ? "text-emerald-300"
                              : "text-red-300"
                          }
                        >
                          {r.status}
                        </span>
                        {r.resolvedAt && (
                          <> · {r.resolvedAt.toISOString().slice(0, 10)}</>
                        )}
                      </span>
                    </span>
                    {r.status === "resolved" && r.shareToken && (
                      <span
                        className={`text-[10px] font-display tracking-wider px-2 py-0.5 rounded-full ${
                          stillLive
                            ? "bg-emerald/20 text-emerald-200"
                            : "bg-border text-muted"
                        }`}
                      >
                        {stillLive ? "Link live" : "Link expired"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </Container>
      <ShareRankingsModal requests={modalRequests} />
    </>
  );
}
