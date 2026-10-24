import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import Link from "next/link";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const e = await prisma.event.findUnique({ where: { id: Number(id) } });
  return e ? { title: e.title } : { title: "Event not found" };
}

export default async function EventPage({ params }: { params: Params }) {
  const { id } = await params;
  const e = await prisma.event.findUnique({
    where: { id: Number(id) },
    include: {
      promotion: true,
      registrations: true,
      bouts: {
        include: {
          red: { include: { passport: true } },
          blue: { include: { passport: true } },
          result: true,
        },
        orderBy: { boutOrder: "asc" },
      },
    },
  });
  if (!e) notFound();
  const isLive = e.status === "Live";

  return (
    <>
      <PageHeader eyebrow={e.subtitle ?? "W.U.C.O event"} title={e.title}>
        {e.description || "Event details to be announced."}
      </PageHeader>
      <Container className="py-10 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <section className="bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="font-display text-2xl text-white tracking-wider">
              Fight card
            </h2>
            {isLive && (
              <span className="inline-flex items-center gap-1.5 bg-red-500 text-white text-[10px] font-display tracking-widest px-3 py-1 rounded-full">
                <span className="size-1.5 rounded-full bg-white animate-pulse" />
                LIVE RESULTS
              </span>
            )}
            {e.status === "Past" && (
              <span className="bg-border text-muted text-[10px] font-display tracking-widest px-3 py-1 rounded-full">
                FINAL RESULTS
              </span>
            )}
          </div>
          {e.bouts.length === 0 ? (
            <p className="text-sm text-muted">
              The fight card for this event has not been published yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {e.bouts.map((b) => {
                const outcome = b.result?.outcome;
                return (
                  <li
                    key={b.id}
                    className={`rounded-xl p-4 border ${
                      outcome ? "border-emerald/40 bg-emerald/5" : "border-border bg-bg/40"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-[10px] font-display tracking-widest text-gold uppercase">
                        Bout #{b.boutOrder} · {b.cardSection}
                      </p>
                      {outcome && (
                        <span className="text-[9px] font-display tracking-widest bg-emerald text-white px-2 py-0.5 rounded-full">
                          {outcome === "draw"
                            ? "DRAW"
                            : outcome === "no_contest"
                              ? "NO CONTEST"
                              : "RESULT"}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
                      <Corner
                        athlete={b.red}
                        corner="red"
                        winner={outcome === "red"}
                      />
                      <div className="font-display text-[10px] tracking-wider text-muted">
                        VS
                      </div>
                      <Corner
                        athlete={b.blue}
                        corner="blue"
                        winner={outcome === "blue"}
                      />
                    </div>
                    {b.resultMethod && outcome && (
                      <p className="text-xs text-muted mt-3 text-center">
                        {b.resultMethod}
                        {b.resultRound ? ` · R${b.resultRound}` : ""}
                        {b.resultTime ? ` · ${b.resultTime}` : ""}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <aside className="bg-surface border border-border rounded-2xl p-6 space-y-3 text-sm">
          <div>
            <p className="font-display text-[10px] tracking-wider text-gold uppercase">
              Status
            </p>
            {isLive ? (
              <p className="font-display text-red-400 tracking-wider mt-1 inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
                LIVE NOW
              </p>
            ) : (
              <p className="text-white mt-1">{e.status}</p>
            )}
          </div>
          <div>
            <p className="font-display text-[10px] tracking-wider text-gold uppercase">
              Date
            </p>
            <p className="text-white">{e.startsAt ?? "To be announced"}</p>
          </div>
          <div>
            <p className="font-display text-[10px] tracking-wider text-gold uppercase">
              Venue
            </p>
            <p className="text-white">{e.venue ?? "TBA"}</p>
            <p className="text-muted text-xs mt-1">{e.city ?? ""}</p>
          </div>
          <div>
            <p className="font-display text-[10px] tracking-wider text-gold uppercase">
              Promotion
            </p>
            <p className="text-white">
              {e.promotion?.name ?? "W.U.C.O Ireland"}
            </p>
          </div>
          <div>
            <p className="font-display text-[10px] tracking-wider text-gold uppercase">
              Registered
            </p>
            <p className="text-white">{e.registrations.length} fighters</p>
          </div>
          {isLive && (
            <p className="text-[10px] text-muted mt-4 border-t border-border pt-3">
              Results refresh automatically every few seconds while the event is live.
            </p>
          )}
        </aside>
      </Container>
    </>
  );
}

function Corner({
  athlete,
  corner,
  winner,
}: {
  athlete: {
    id: number;
    name: string;
    wins: number;
    losses: number;
    draws: number;
    passport: { fighterNo: string } | null;
  };
  corner: "red" | "blue";
  winner: boolean;
}) {
  const colors =
    corner === "red"
      ? "bg-red-950/40 border-red-500/40"
      : "bg-blue-950/40 border-blue-500/40";
  return (
    <Link
      href={`/fighters/${athlete.id}`}
      className={`block rounded-lg border p-3 ${colors} ${winner ? "ring-2 ring-emerald" : ""}`}
    >
      <p
        className={`font-display text-[9px] tracking-widest uppercase mb-1 ${corner === "red" ? "text-red-300" : "text-blue-300"}`}
      >
        {corner === "red" ? "Red corner" : "Blue corner"}
      </p>
      <p className="font-display text-base text-white tracking-wider">
        {athlete.name}
      </p>
      <p className="text-xs text-muted mt-0.5">
        {athlete.wins}–{athlete.losses}–{athlete.draws}
        {athlete.passport?.fighterNo && (
          <span className="ml-2 text-gold">{athlete.passport.fighterNo}</span>
        )}
      </p>
      {winner && (
        <p className="font-display text-[10px] tracking-widest text-emerald mt-1.5">
          WINNER
        </p>
      )}
    </Link>
  );
}
