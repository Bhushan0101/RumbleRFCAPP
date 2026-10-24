import Link from "next/link";
import { prisma } from "@/lib/prisma";

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function parseDate(startsAt: string | null | undefined) {
  const m = (startsAt ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return { month: "TBA", day: "—" };
  return { month: MONTHS[parseInt(m[2], 10) - 1] ?? "TBA", day: m[3] };
}

export async function EventsPanel() {
  const events = await prisma.event
    .findMany({
      where: { status: "Upcoming" },
      orderBy: { id: "desc" },
      take: 3,
    })
    .catch(() => []);

  return (
    <section className="bg-surface border border-border overflow-hidden rounded-2xl">
      <header className="flex items-center justify-between px-6 py-5 border-b border-border bg-surface-3">
        <h2 className="font-display text-lg tracking-wider text-white">
          UPCOMING EVENTS
        </h2>
        <Link
          href="/events"
          className="text-xs font-display tracking-wider text-gold border-b border-gold pb-1 hover:text-gold-hi"
        >
          VIEW ALL ↗
        </Link>
      </header>
      {events.length === 0 ? (
        <p className="p-6 text-sm text-muted">
          No events scheduled yet. Published events will appear here.
        </p>
      ) : (
        <ul>
          {events.map((e) => {
            const { month, day } = parseDate(e.startsAt);
            return (
              <li key={e.id}>
                <Link
                  href={`/events/${e.id}`}
                  className="flex items-center gap-4 px-6 py-4 border-t border-border first:border-t-0 hover:bg-surface-3 transition-colors"
                >
                  <div className="w-14 shrink-0 bg-emerald text-white text-center py-1.5 rounded-lg">
                    <div className="font-display text-[10px] tracking-wider text-gold">
                      {month}
                    </div>
                    <div className="font-display text-2xl font-black leading-none">
                      {day}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-base tracking-wider text-white uppercase truncate">
                      {e.title}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {e.city || e.venue || "Venue TBA"}
                    </div>
                    <div className="mt-1 inline-flex gap-1 text-[10px] tracking-wider text-[#cfe3d8]">
                      <span className="px-2 py-0.5 bg-surface-3 border border-border rounded-full">
                        {e.subtitle || "K-1"}
                      </span>
                    </div>
                  </div>
                  <span className="text-gold">↗</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
