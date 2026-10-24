import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { addBout, settleBout, setEventStatus } from "@/app/actions/fight-day";
import { Flame } from "lucide-react";

export const metadata = { title: "Ranking · Event" };

type Params = Promise<{ id: string }>;

export default async function RankingEventPage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user) redirect("/portal/sign-in");
  if (session.user.role !== "admin" && session.user.role !== "ranking_admin") {
    redirect("/portal");
  }

  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id: Number(id) },
    include: {
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
  if (!event) notFound();

  const fighters = await prisma.athlete.findMany({
    where: { profile: { approvalStatus: "approved" } },
    orderBy: { name: "asc" },
  });

  const isLive = event.status === "Live";

  return (
    <>
      <PageHeader
        eyebrow={event.subtitle ?? "Fight Day"}
        title={event.title}
      >
        {event.city || event.venue || "Venue TBA"} ·{" "}
        {event.startsAt || "Date TBA"}
      </PageHeader>
      <Container className="py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Link
            href="/portal/ranking"
            className="text-xs text-gold font-display tracking-wider"
          >
            ← Back to Ranking Administration
          </Link>
          <div className="flex items-center gap-2">
            <StatusBadge status={event.status} />
            {event.status !== "Live" && (
              <form action={setEventStatus}>
                <input type="hidden" name="event_id" value={event.id} />
                <input type="hidden" name="status" value="Live" />
                <button className="inline-flex items-center gap-1.5 bg-red-500 text-white px-3 py-1.5 text-[10px] font-display tracking-wider rounded-full hover:bg-red-400">
                  <Flame className="size-3" />
                  START FIGHT DAY
                </button>
              </form>
            )}
            {event.status === "Live" && (
              <form action={setEventStatus}>
                <input type="hidden" name="event_id" value={event.id} />
                <input type="hidden" name="status" value="Past" />
                <button className="inline-flex items-center gap-1.5 bg-gold text-bg px-3 py-1.5 text-[10px] font-display tracking-wider rounded-full hover:bg-gold-hi">
                  CLOSE EVENT
                </button>
              </form>
            )}
            {event.status === "Live" && (
              <Link
                href={`/events/${event.id}`}
                target="_blank"
                className="text-xs text-gold font-display tracking-wider border-b border-gold pb-0.5"
              >
                PUBLIC VIEW ↗
              </Link>
            )}
          </div>
        </div>

        {/* Bouts */}
        <section className="space-y-3">
          <h2 className="font-display text-xl text-white tracking-wider">
            Fight card
          </h2>
          {event.bouts.length === 0 ? (
            <EmptyState title="No bouts yet. Add the first bout below." />
          ) : (
            <ul className="space-y-3">
              {event.bouts.map((b) => {
                const outcome = b.result?.outcome;
                return (
                  <li
                    key={b.id}
                    className={`bg-surface border rounded-2xl p-5 ${
                      outcome
                        ? "border-emerald/40"
                        : isLive
                          ? "border-red-500/60"
                          : "border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[10px] font-display tracking-widest text-gold uppercase">
                        Bout #{b.boutOrder} · {b.cardSection}
                      </p>
                      {outcome && (
                        <span className="inline-block text-[9px] font-display tracking-widest bg-emerald text-white px-2 py-0.5 rounded-full">
                          SETTLED
                        </span>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
                      <CornerCard
                        corner="red"
                        athlete={b.red}
                        winner={outcome === "red"}
                      />
                      <div className="text-center font-display text-[10px] tracking-wider text-muted">
                        VS
                      </div>
                      <CornerCard
                        corner="blue"
                        athlete={b.blue}
                        winner={outcome === "blue"}
                      />
                    </div>

                    <div className="mt-5">
                      <h3 className="font-display text-[10px] tracking-widest text-gold uppercase mb-2">
                        {outcome ? "Update result" : "Record result"}
                      </h3>
                      <form
                        action={settleBout}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input type="hidden" name="bout_id" value={b.id} />
                        <WinnerButton
                          name="outcome"
                          value="red"
                          selected={outcome === "red"}
                          label={`${b.red.name} wins`}
                          color="red"
                        />
                        <WinnerButton
                          name="outcome"
                          value="blue"
                          selected={outcome === "blue"}
                          label={`${b.blue.name} wins`}
                          color="blue"
                        />
                        <WinnerButton
                          name="outcome"
                          value="draw"
                          selected={outcome === "draw"}
                          label="Draw"
                          color="gold"
                        />
                        <WinnerButton
                          name="outcome"
                          value="no_contest"
                          selected={outcome === "no_contest"}
                          label="No contest"
                          color="muted"
                        />
                        <input
                          name="method"
                          placeholder="Method (e.g. KO)"
                          defaultValue={b.resultMethod ?? "Decision"}
                          className="px-3 py-1.5 bg-bg border border-border rounded-full text-white text-xs w-32"
                        />
                        <input
                          name="round"
                          type="number"
                          min={1}
                          max={20}
                          placeholder="Round"
                          defaultValue={b.resultRound ?? ""}
                          className="px-3 py-1.5 bg-bg border border-border rounded-full text-white text-xs w-20 text-center"
                        />
                        <input
                          name="time"
                          placeholder="Time"
                          defaultValue={b.resultTime ?? ""}
                          className="px-3 py-1.5 bg-bg border border-border rounded-full text-white text-xs w-20 text-center"
                        />
                      </form>
                      <p className="text-[10px] text-muted mt-2">
                        Pick a winner to record · W/L/D update instantly on both fighters.
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Add bout */}
        <section className="bg-surface border border-border rounded-2xl p-5">
          <h2 className="font-display text-xl text-white tracking-wider mb-4">
            Add bout
          </h2>
          <form
            action={addBout}
            className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]"
          >
            <input type="hidden" name="event_id" value={event.id} />
            <label>
              <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
                Red corner
              </span>
              <select
                name="red_id"
                required
                className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-white text-sm"
              >
                {fighters.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.wins}-{f.losses}-{f.draws})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
                Blue corner
              </span>
              <select
                name="blue_id"
                required
                className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-white text-sm"
              >
                {fighters.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.wins}-{f.losses}-{f.draws})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
                Section
              </span>
              <input
                name="card_section"
                defaultValue="Main"
                className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-white text-sm"
              />
            </label>
            <button className="self-end bg-gold text-bg px-5 py-2 text-xs font-display tracking-wider rounded-full hover:bg-gold-hi">
              ADD →
            </button>
          </form>
        </section>
      </Container>
    </>
  );
}

function CornerCard({
  corner,
  athlete,
  winner,
}: {
  corner: "red" | "blue";
  athlete: { name: string; wins: number; losses: number; draws: number; passport: { fighterNo: string } | null };
  winner: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        corner === "red"
          ? "bg-red-950/40 border-red-500/50"
          : "bg-blue-950/40 border-blue-500/50"
      } ${winner ? "ring-2 ring-emerald" : ""}`}
    >
      <p
        className={`font-display text-[9px] tracking-widest uppercase mb-1 ${corner === "red" ? "text-red-300" : "text-blue-300"}`}
      >
        {corner === "red" ? "Red corner" : "Blue corner"}
      </p>
      <p className="font-display text-base text-white tracking-wider">
        {athlete.name}
      </p>
      <p className="text-xs text-muted mt-1">
        {athlete.wins}–{athlete.losses}–{athlete.draws}
        {athlete.passport?.fighterNo && (
          <span className="ml-2 text-gold">{athlete.passport.fighterNo}</span>
        )}
      </p>
      {winner && (
        <p className="font-display text-[10px] tracking-widest text-emerald mt-2">
          WINNER
        </p>
      )}
    </div>
  );
}

function WinnerButton({
  name,
  value,
  selected,
  label,
  color,
}: {
  name: string;
  value: string;
  selected: boolean;
  label: string;
  color: "red" | "blue" | "gold" | "muted";
}) {
  const base =
    "px-4 py-2 font-display text-[11px] tracking-wider uppercase rounded-full transition-colors";
  const styles = selected
    ? {
        red: "bg-red-500 text-white",
        blue: "bg-blue-500 text-white",
        gold: "bg-gold text-bg",
        muted: "bg-border text-white",
      }[color]
    : {
        red: "border border-red-500/60 text-red-300 hover:bg-red-500 hover:text-white",
        blue: "border border-blue-500/60 text-blue-300 hover:bg-blue-500 hover:text-white",
        gold: "border border-gold text-gold hover:bg-gold hover:text-bg",
        muted: "border border-border text-muted hover:border-gold hover:text-gold",
      }[color];
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={`${base} ${styles}`}
    >
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Live") {
    return (
      <span className="inline-flex items-center gap-1.5 bg-red-500 text-white text-[10px] font-display tracking-widest px-3 py-1 rounded-full">
        <span className="size-1.5 rounded-full bg-white animate-pulse" />
        LIVE
      </span>
    );
  }
  if (status === "Past") {
    return (
      <span className="bg-border text-muted text-[10px] font-display tracking-widest px-3 py-1 rounded-full">
        CLOSED
      </span>
    );
  }
  return (
    <span className="bg-gold/20 text-gold text-[10px] font-display tracking-widest px-3 py-1 rounded-full">
      UPCOMING
    </span>
  );
}
