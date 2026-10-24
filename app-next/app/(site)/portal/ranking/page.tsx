import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3, Trophy, Flame } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";

export const metadata = { title: "Ranking admin" };

export default async function RankingWorkspacePage() {
  const session = await auth();
  if (!session?.user) redirect("/portal/sign-in");
  if (session.user.role !== "admin" && session.user.role !== "ranking_admin") {
    redirect("/portal");
  }

  const [live, upcoming] = await Promise.all([
    prisma.event.findMany({
      where: { status: "Live" },
      include: { _count: { select: { bouts: true } } },
      orderBy: { startsAt: "desc" },
    }),
    prisma.event.findMany({
      where: { status: "Upcoming" },
      include: { _count: { select: { bouts: true } } },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader eyebrow="Ranking Administration" title={`Hi, ${session.user.name}`}>
        {session.user.role === "ranking_admin"
          ? "Your workspace: manage rankings and record results on fight nights."
          : "Admin and ranking tools."}
      </PageHeader>
      <Container className="py-10 space-y-10">
        {/* Top-line tiles */}
        <div className="grid grid-cols-2 gap-4 max-w-xl">
          <Link
            href="/portal/ranking/rankings"
            className="group bg-surface border border-border rounded-2xl p-6 hover:border-gold transition-colors"
          >
            <BarChart3 className="size-6 text-gold" />
            <h2 className="font-display text-xl text-white tracking-wider mt-3">
              Ranking Administration
            </h2>
            <p className="text-xs text-muted mt-2 leading-relaxed">
              Set athlete positions per division. Auto-compacts gaps.
            </p>
            <span className="text-xs text-gold font-display tracking-wider inline-block mt-3">
              OPEN →
            </span>
          </Link>
          <Link
            href="#fight-day"
            className="group bg-surface border border-border rounded-2xl p-6 hover:border-gold transition-colors relative overflow-hidden"
          >
            <Flame className="size-6 text-red-400" />
            {live.length > 0 && (
              <span className="absolute top-4 right-4 inline-flex items-center gap-1.5 bg-red-500 text-white text-[9px] font-display tracking-wider px-2 py-1 rounded-full">
                <span className="size-1.5 rounded-full bg-white animate-pulse" />
                {live.length} LIVE
              </span>
            )}
            <h2 className="font-display text-xl text-white tracking-wider mt-3">
              Fight Day
            </h2>
            <p className="text-xs text-muted mt-2 leading-relaxed">
              Record bout results in real time. Updates fighter records instantly.
            </p>
            <span className="text-xs text-gold font-display tracking-wider inline-block mt-3">
              {live.length > 0 ? "GO LIVE →" : "VIEW EVENTS →"}
            </span>
          </Link>
        </div>

        {/* Fight Day — live events */}
        <section id="fight-day" className="space-y-5">
          <h2 className="font-display text-2xl text-white tracking-wider">
            Fight Day
          </h2>
          {live.length === 0 ? (
            <p className="text-sm text-muted">
              No live events right now. Flip an upcoming event to <strong className="text-gold">Live</strong> to start recording results.
            </p>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {live.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/portal/ranking/events/${e.id}`}
                    className="relative block bg-gradient-to-br from-[#07251b] via-[#0b3d2e] to-[#0a2f23] border-2 border-red-500 rounded-2xl p-5 overflow-hidden hover:border-red-400 transition-colors"
                  >
                    <span className="absolute top-4 right-4 inline-flex items-center gap-1.5 bg-red-500 text-white text-[9px] font-display tracking-wider px-2 py-1 rounded-full">
                      <span className="size-1.5 rounded-full bg-white animate-pulse" />
                      LIVE
                    </span>
                    <p className="font-display text-[10px] tracking-widest text-gold mb-2">
                      {e.subtitle || "W.U.C.O"}
                    </p>
                    <h3 className="font-display text-xl text-white tracking-wider">
                      {e.title}
                    </h3>
                    <p className="text-xs text-muted mt-1">
                      {e.city || e.venue || "Venue TBA"}
                    </p>
                    <p className="text-xs text-gold font-display tracking-wider mt-3">
                      {e._count.bouts} bouts · RECORD RESULTS →
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Upcoming events — "Coming soon" ticket style */}
        <section className="space-y-5">
          <h2 className="font-display text-2xl text-white tracking-wider">
            Coming soon
          </h2>
          {upcoming.length === 0 ? (
            <EmptyState
              title="No upcoming events."
              description="Add an event in the admin tools; flip it to Live when the night begins."
            />
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcoming.map((e) => (
                <li
                  key={e.id}
                  className="relative bg-surface border border-border rounded-2xl p-5 overflow-hidden"
                >
                  <span className="absolute top-4 right-4 inline-flex items-center gap-1 bg-gold/20 text-gold text-[9px] font-display tracking-wider px-2 py-1 rounded-full">
                    COMING SOON
                  </span>
                  <p className="font-display text-[10px] tracking-widest text-gold mb-2">
                    {e.subtitle || "W.U.C.O"}
                  </p>
                  <h3 className="font-display text-xl text-white tracking-wider">
                    {e.title}
                  </h3>
                  <p className="text-xs text-muted mt-1">
                    {e.startsAt ? e.startsAt : "Date TBA"} ·{" "}
                    {e.city || e.venue || "Venue TBA"}
                  </p>
                  <div className="flex items-center gap-2 mt-4">
                    <GoLiveForm eventId={e.id} />
                    <Link
                      href={`/portal/ranking/events/${e.id}`}
                      className="text-xs text-gold font-display tracking-wider border-b border-gold pb-0.5"
                    >
                      PREP BOUTS →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form action={signOutAction}>
          <button className="text-xs text-muted hover:text-white underline">
            Sign out
          </button>
        </form>
      </Container>
    </>
  );
}

// Server-action-powered inline form for Go Live
import { setEventStatus } from "@/app/actions/fight-day";
function GoLiveForm({ eventId }: { eventId: number }) {
  return (
    <form action={setEventStatus}>
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="status" value="Live" />
      <button className="inline-flex items-center gap-1.5 bg-red-500 text-white px-3 py-1.5 text-[10px] font-display tracking-wider rounded-full hover:bg-red-400">
        <Trophy className="size-3" /> GO LIVE
      </button>
    </form>
  );
}
