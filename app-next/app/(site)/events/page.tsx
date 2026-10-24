import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = {
  title: "Events",
  description: "W.U.C.O Ireland upcoming events and championships.",
};

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

export default async function EventsPage() {
  const events = await prisma.event.findMany({
    orderBy: [{ status: "asc" }, { startsAt: "asc" }],
    include: { _count: { select: { registrations: true } } },
  });

  return (
    <>
      <PageHeader eyebrow="The W.U.C.O calendar" title="Events">
        Upcoming showcases, national championships and sanctioned events. Only
        published events are shown.
      </PageHeader>
      <Container className="py-10">
        {events.length === 0 ? (
          <EmptyState
            title="No events scheduled yet."
            description="Approved events will appear here as promoters publish them."
          />
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map((e) => {
              const m = (e.startsAt ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
              const month = m ? MONTHS[parseInt(m[2], 10) - 1] : "TBA";
              const day = m ? m[3] : "—";
              return (
                <li key={e.id}>
                  <Link
                    href={`/events/${e.id}`}
                    className="group flex flex-col bg-surface border border-border overflow-hidden h-full"
                  >
                    <div className="h-40 bg-emerald/40 relative overflow-hidden">
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(/brand/arena.webp)` }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
                      <div className="absolute left-4 top-4 bg-emerald text-white w-16 text-center py-2 rounded-lg">
                        <div className="font-display text-[10px] tracking-wider text-gold">
                          {month}
                        </div>
                        <div className="font-display text-2xl font-black leading-none">
                          {day}
                        </div>
                      </div>
                      {e.status === "Live" && (
                        <span className="absolute top-4 right-4 inline-flex items-center gap-1.5 bg-red-500 text-white text-[9px] font-display tracking-widest px-2 py-1 rounded-full">
                          <span className="size-1.5 rounded-full bg-white animate-pulse" />
                          LIVE
                        </span>
                      )}
                    </div>
                    <div className="p-5 flex flex-col gap-2 flex-1">
                      <p className="font-display text-[10px] tracking-wider text-gold">
                        {e.subtitle || "W.U.C.O"}
                      </p>
                      <h3 className="font-display text-xl text-white tracking-wider">
                        {e.title}
                      </h3>
                      <p className="text-xs text-muted">
                        {e.city || e.venue || "Venue TBA"}
                      </p>
                      <p className="text-xs text-muted mt-auto">
                        {e._count.registrations} registered
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Container>
    </>
  );
}
