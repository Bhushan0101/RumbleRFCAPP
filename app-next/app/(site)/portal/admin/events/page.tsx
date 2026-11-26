import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  saveEvent,
  deleteEvent,
  recordBoutResult,
  deleteBout,
} from "@/app/actions/admin-editor";
import { divisionDisplayName } from "@/lib/divisions";
import { martialArtName } from "@/lib/martial-arts";
import {
  AdminOfferBoutForm,
  type OpponentOption,
} from "@/components/site/admin-offer-bout-form";
import {
  AdminAddBoutForm,
  type FighterPickOption,
} from "@/components/site/admin-add-bout-form";
import { publishConfirmedBout } from "@/app/actions/event-flow";

export const metadata = { title: "Admin · Events & bouts" };

export default async function AdminEventsPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/portal/sign-in");

  const [events, fighters] = await Promise.all([
    prisma.event.findMany({
      orderBy: { startsAt: "desc" },
      include: {
        _count: { select: { bouts: true, registrations: true } },
        bouts: {
          include: {
            red: true,
            blue: true,
            result: true,
          },
          orderBy: { boutOrder: "asc" },
        },
        registrations: {
          include: {
            athlete: { include: { disciplines: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.athlete.findMany({
      where: { profile: { approvalStatus: "approved" } },
      include: { disciplines: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Flatten the full opponent pool once; the client form filters by the chosen
  // division + the interested fighter's primary discipline.
  const opponentPool: OpponentOption[] = fighters.map((f) => {
    const primary = f.disciplines.find((d) => d.isPrimary === 1) ?? f.disciplines[0];
    return {
      id: f.id,
      name: f.name,
      division: f.division ?? "",
      martialArt: primary?.martialArt ?? f.martialArt ?? "",
      wins: f.wins,
      losses: f.losses,
      draws: f.draws,
    };
  });

  const addBoutPool: FighterPickOption[] = fighters.map((f) => {
    const primary = f.disciplines.find((d) => d.isPrimary === 1) ?? f.disciplines[0];
    return {
      id: f.id,
      name: f.name,
      gender: f.gender ?? "",
      division: f.division ?? "",
      martialArt: primary?.martialArt ?? f.martialArt ?? "",
      wins: f.wins,
      losses: f.losses,
      draws: f.draws,
    };
  });

  return (
    <>
      <PageHeader eyebrow="Administrator" title="Events & bouts">
        Create and edit events, publish fight cards, record results. Recording
        a result auto-updates each athlete&apos;s win/loss/draw record.
      </PageHeader>
      <Container className="py-10 space-y-6">
        <Link
          href="/portal"
          className="text-xs text-gold font-display tracking-wider"
        >
          ← Back to dashboard
        </Link>

        {/* New event */}
        <section className="bg-surface border border-border p-5 rounded-xl">
          <h2 className="font-display text-xl text-white tracking-wider mb-4">
            Create event
          </h2>
          <form
            action={saveEvent}
            className="grid gap-3 md:grid-cols-3"
          >
            <F label="Title" name="title" required />
            <F label="Subtitle" name="subtitle" />
            <F label="Starts at (YYYY-MM-DD)" name="starts_at" />
            <F label="Venue" name="venue" />
            <F label="City" name="city" />
            <label className="block">
              <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
                Status
              </span>
              <select
                name="status"
                defaultValue="Upcoming"
                className="w-full px-3 py-2 bg-bg border border-border text-white text-sm"
              >
                <option>Upcoming</option>
                <option>Live</option>
                <option>Past</option>
              </select>
            </label>
            <label className="block md:col-span-3">
              <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
                Cover photo (optional, 5 MB max)
              </span>
              <input
                type="file"
                name="poster"
                accept="image/*"
                className="block w-full text-xs text-muted
                  file:mr-3 file:py-2 file:px-3 file:rounded-full file:border-0
                  file:text-xs file:font-display file:tracking-wider file:uppercase
                  file:bg-gold file:text-bg hover:file:bg-gold-hi cursor-pointer"
              />
            </label>
            <label className="block md:col-span-3">
              <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
                Description
              </span>
              <textarea
                name="description"
                rows={2}
                className="w-full px-3 py-2 bg-bg border border-border text-white text-sm"
              />
            </label>
            <div className="md:col-span-3">
              <button className="bg-gold text-bg px-5 py-2 text-xs font-display tracking-wider hover:bg-gold-hi">
                CREATE EVENT →
              </button>
            </div>
          </form>
        </section>

        {/* Existing events */}
        {events.length === 0 ? (
          <EmptyState title="No events yet." />
        ) : (
          events.map((e) => (
            <article
              key={e.id}
              className="bg-surface border border-border p-5 rounded-xl space-y-4"
            >
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-4 items-start">
                  {e.posterUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.posterUrl}
                      alt=""
                      className="w-24 h-24 object-cover rounded-lg border border-border flex-shrink-0"
                    />
                  )}
                  <div>
                    <h3 className="font-display text-2xl text-white tracking-wider">
                      {e.title}
                    </h3>
                    <p className="text-xs text-muted mt-1">
                      {e.startsAt || "Date TBA"} · {e.city} · {e.venue} ·{" "}
                      <span className="text-gold">
                        {e._count.registrations} registered · {e._count.bouts}{" "}
                        bouts
                      </span>
                    </p>
                  </div>
                </div>
                <span
                  className={`inline-block px-2 py-1 text-[10px] tracking-wider font-display ${
                    e.status === "Upcoming"
                      ? "bg-gold text-bg"
                      : e.status === "Live"
                        ? "bg-red-500 text-white"
                        : "bg-border text-white"
                  }`}
                >
                  {e.status.toUpperCase()}
                </span>
              </header>

              <div className="grid gap-4 md:grid-cols-2">
                <details className="bg-bg border border-border rounded-lg">
                  <summary className="cursor-pointer px-4 py-3 font-display text-xs tracking-wider text-gold uppercase">
                    Edit event
                  </summary>
                  <form
                    action={saveEvent}
                    className="p-4 space-y-3"
                  >
                    <input type="hidden" name="id" value={e.id} />
                    <F label="Title" name="title" def={e.title} required />
                    <F label="Subtitle" name="subtitle" def={e.subtitle ?? ""} />
                    <F
                      label="Starts at (YYYY-MM-DD)"
                      name="starts_at"
                      def={e.startsAt ?? ""}
                    />
                    <F label="Venue" name="venue" def={e.venue ?? ""} />
                    <F label="City" name="city" def={e.city ?? ""} />
                    <label className="block">
                      <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
                        Description
                      </span>
                      <textarea
                        name="description"
                        rows={3}
                        defaultValue={e.description ?? ""}
                        className="w-full px-3 py-2 bg-bg border border-border text-white text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
                        Status
                      </span>
                      <select
                        name="status"
                        defaultValue={e.status}
                        className="w-full px-3 py-2 bg-bg border border-border text-white text-sm"
                      >
                        <option>Upcoming</option>
                        <option>Live</option>
                        <option>Past</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
                        Replace cover photo
                      </span>
                      <input
                        type="file"
                        name="poster"
                        accept="image/*"
                        className="block w-full text-xs text-muted
                          file:mr-3 file:py-2 file:px-3 file:rounded-full file:border-0
                          file:text-xs file:font-display file:tracking-wider file:uppercase
                          file:bg-gold file:text-bg hover:file:bg-gold-hi cursor-pointer"
                      />
                    </label>
                    {e.posterUrl && (
                      <label className="flex items-center gap-2 text-xs text-muted">
                        <input
                          type="checkbox"
                          name="remove_poster"
                          value="1"
                          className="accent-gold"
                        />
                        Remove current cover photo
                      </label>
                    )}
                    <div className="flex gap-2">
                      <button className="bg-emerald text-white px-4 py-2 text-xs font-display tracking-wider hover:bg-emerald-hi">
                        SAVE
                      </button>
                    </div>
                  </form>
                </details>

                <details className="bg-bg border border-border rounded-lg">
                  <summary className="cursor-pointer px-4 py-3 font-display text-xs tracking-wider text-gold uppercase">
                    + Add bout (offer — awaits both fighters&apos; acceptance)
                  </summary>
                  <AdminAddBoutForm
                    eventId={e.id}
                    nextOrder={e._count.bouts + 1}
                    fighters={addBoutPool}
                  />
                </details>
              </div>

              {/* Confirmed bouts awaiting publish onto the fight card. */}
              {(() => {
                // Group confirmed registrations by boutRef. A pair of
                // confirmed rows with the same boutRef = a bout both fighters
                // have accepted — admin can now publish it onto the card.
                const confirmed = e.registrations.filter(
                  (r) => r.status === "confirmed" && r.boutRef,
                );
                const byRef = new Map<string, typeof confirmed>();
                for (const r of confirmed) {
                  const list = byRef.get(r.boutRef!) ?? [];
                  list.push(r);
                  byRef.set(r.boutRef!, list);
                }
                // Only pairs that aren't already on the fight card.
                const pairs = Array.from(byRef.values()).filter((group) => {
                  if (group.length !== 2) return false;
                  const [a, b] = group;
                  return !e.bouts.some(
                    (bt) =>
                      (bt.redAthleteId === a.athleteId && bt.blueAthleteId === b.athleteId) ||
                      (bt.redAthleteId === b.athleteId && bt.blueAthleteId === a.athleteId),
                  );
                });
                if (pairs.length === 0) return null;
                return (
                  <div className="bg-bg border border-emerald/40 rounded-lg p-4">
                    <p className="font-display text-xs tracking-wider text-emerald uppercase mb-3">
                      Ready to publish ({pairs.length})
                    </p>
                    <ul className="divide-y divide-border/60">
                      {pairs.map((group) => {
                        const [a, b] = group;
                        return (
                          <li
                            key={a.boutRef}
                            className="py-2 flex flex-wrap items-center gap-3 text-sm"
                          >
                            <span className="text-white">
                              <span className="text-red-300">{a.athlete.name}</span>
                              <span className="text-muted mx-2">vs</span>
                              <span className="text-blue-300">{b.athlete.name}</span>
                              {a.offerDivision && (
                                <span className="ml-2 text-xs text-muted">
                                  · {divisionDisplayName(null, a.offerDivision)}
                                </span>
                              )}
                            </span>
                            <form
                              action={publishConfirmedBout}
                              className="ml-auto"
                            >
                              <input type="hidden" name="event_id" value={e.id} />
                              <input type="hidden" name="bout_ref" value={a.boutRef!} />
                              <button
                                type="submit"
                                className="bg-emerald text-white px-3 py-1.5 text-xs font-display tracking-wider hover:bg-emerald-hi rounded"
                              >
                                PUBLISH ON CARD →
                              </button>
                            </form>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })()}

              {/* Existing bouts on this event */}
              {e.bouts.length > 0 && (
                <div className="bg-bg border border-border rounded-lg p-4">
                  <p className="font-display text-xs tracking-wider text-gold uppercase mb-3">
                    Fight card ({e.bouts.length})
                  </p>
                  <ul className="divide-y divide-border/60">
                    {e.bouts.map((b) => (
                      <li
                        key={b.id}
                        className="py-2 flex flex-wrap items-center gap-2 text-sm"
                      >
                        <span className="font-display text-[10px] tracking-wider text-gold uppercase w-10">
                          #{b.boutOrder}
                        </span>
                        <span className="text-[10px] font-display tracking-wider text-muted uppercase w-16">
                          {b.cardSection}
                        </span>
                        <span className="text-white">
                          <span className="text-red-300">{b.red.name}</span>
                          <span className="text-muted mx-2">vs</span>
                          <span className="text-blue-300">{b.blue.name}</span>
                        </span>
                        {b.division && (
                          <span className="text-xs text-muted">
                            · {divisionDisplayName(null, b.division)}
                          </span>
                        )}
                        {b.result && (
                          <span className="text-[9px] font-display tracking-widest bg-emerald text-white px-2 py-0.5 rounded-full ml-auto">
                            RESULT
                          </span>
                        )}
                        {!b.result && (
                          <form action={deleteBout} className="ml-auto">
                            <input type="hidden" name="id" value={b.id} />
                            <button
                              type="submit"
                              className="text-[11px] text-red-400 hover:text-red-300 underline"
                            >
                              remove
                            </button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Interest / offer management */}
              {e.registrations.length > 0 && (
                <RegistrationsPanel
                  eventId={e.id}
                  opponents={opponentPool}
                  registrations={e.registrations.map((r) => {
                    const primary =
                      r.athlete.disciplines.find((d) => d.isPrimary === 1) ??
                      r.athlete.disciplines[0];
                    return {
                      id: r.id,
                      status: r.status,
                      athleteId: r.athleteId,
                      athleteName: r.athlete.name,
                      athleteDivision: r.athlete.division ?? "",
                      athleteMartialArt: primary?.martialArt ?? r.athlete.martialArt ?? "",
                      athleteRecord: `${r.athlete.wins}-${r.athlete.losses}-${r.athlete.draws}`,
                      offerOpponent: r.offerOpponent,
                      offerDivision: r.offerDivision,
                      offerSection: r.offerSection,
                      offerNote: r.offerNote,
                      offerSentAt: r.offerSentAt?.toISOString() ?? null,
                      respondedAt: r.respondedAt?.toISOString() ?? null,
                      confirmedAt: r.confirmedAt?.toISOString() ?? null,
                    };
                  })}
                />
              )}

              <details className="bg-bg border border-border rounded-lg">
                <summary className="cursor-pointer px-4 py-3 font-display text-xs tracking-wider text-gold uppercase">
                  + Record a bout result (closes a bout & updates records)
                </summary>
                <form action={recordBoutResult} className="p-4 space-y-3">
                  <input type="hidden" name="event_id" value={e.id} />
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
                        Red corner
                      </span>
                      <select
                        name="red_id"
                        required
                        className="w-full px-3 py-2 bg-bg border border-border text-white text-sm"
                      >
                        {fighters.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
                        Blue corner
                      </span>
                      <select
                        name="blue_id"
                        required
                        className="w-full px-3 py-2 bg-bg border border-border text-white text-sm"
                      >
                        {fighters.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="block">
                    <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
                      Outcome
                    </span>
                    <select
                      name="outcome"
                      required
                      className="w-full px-3 py-2 bg-bg border border-border text-white text-sm"
                    >
                      <option value="red">Red wins</option>
                      <option value="blue">Blue wins</option>
                      <option value="draw">Draw</option>
                    </select>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <F label="Method" name="method" def="Decision" />
                    <F label="Round" name="round" type="number" />
                    <F label="Time" name="time" def="05:00" />
                  </div>
                  <button className="bg-gold text-bg px-4 py-2 text-xs font-display tracking-wider hover:bg-gold-hi">
                    RECORD RESULT →
                  </button>
                </form>
              </details>

              <form action={deleteEvent}>
                <input type="hidden" name="id" value={e.id} />
                <button type="submit" className="text-xs text-red-400 underline">
                  Delete event
                </button>
              </form>
            </article>
          ))
        )}
      </Container>
    </>
  );
}

function F({
  label,
  name,
  def = "",
  required,
  type = "text",
}: {
  label: string;
  name: string;
  def?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
        {label}
      </span>
      <input
        name={name}
        defaultValue={def}
        required={required}
        type={type}
        className="w-full px-3 py-2 bg-bg border border-border text-white text-sm"
      />
    </label>
  );
}

type Registration = {
  id: number;
  status: string;
  athleteId: number;
  athleteName: string;
  athleteDivision: string;
  athleteMartialArt: string;
  athleteRecord: string;
  offerOpponent: string;
  offerDivision: string;
  offerSection: string;
  offerNote: string;
  offerSentAt: string | null;
  respondedAt: string | null;
  confirmedAt: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  interested: "bg-gold/20 text-gold",
  pending_fighter: "bg-gold/10 text-gold border border-gold/40",
  offered: "bg-orange-500/30 text-orange-200",
  accepted: "bg-emerald/30 text-emerald-200",
  declined: "bg-red-500/30 text-red-200",
  confirmed: "bg-emerald text-white",
  cancelled: "bg-border text-muted",
};

function RegistrationsPanel({
  eventId,
  registrations,
  opponents,
}: {
  eventId: number;
  registrations: Registration[];
  opponents: OpponentOption[];
}) {
  return (
    <div className="bg-bg border border-border rounded-lg p-4">
      <p className="font-display text-xs tracking-wider text-gold uppercase mb-3">
        Fighter interest ({registrations.length})
      </p>
      <ul className="divide-y divide-border/60">
        {registrations.map((r) => (
          <li key={r.id} className="py-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-white font-display tracking-wider">
                {r.athleteName}
              </span>
              <span
                className={`inline-block px-2 py-0.5 text-[10px] tracking-wider font-display rounded-full ${
                  STATUS_STYLE[r.status] ?? "bg-border text-white"
                }`}
              >
                {r.status.replace("_", " ").toUpperCase()}
              </span>
              {r.offerSentAt && (
                <span className="text-[10px] text-muted">
                  offered {r.offerSentAt.slice(0, 10)}
                </span>
              )}
              {r.respondedAt && (
                <span className="text-[10px] text-muted">
                  · responded {r.respondedAt.slice(0, 10)}
                </span>
              )}
              {r.confirmedAt && (
                <span className="text-[10px] text-emerald-300 font-display tracking-wider">
                  · confirmed {r.confirmedAt.slice(0, 10)}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted">
              {r.athleteMartialArt ? martialArtName(r.athleteMartialArt) : "—"}
              {" · "}
              {r.athleteDivision
                ? divisionDisplayName(null, r.athleteDivision)
                : "no division"}
              {" · "}
              <span className="text-white">{r.athleteRecord}</span>
            </p>
            {(r.status === "offered" ||
              r.status === "accepted" ||
              r.status === "declined" ||
              r.status === "confirmed") && (
              <p className="text-xs text-muted">
                Offer: {r.offerOpponent || "—"}
                {r.offerDivision && ` · ${divisionDisplayName(null, r.offerDivision)}`}
                {r.offerSection && ` · ${r.offerSection}`}
                {r.offerNote && ` · ${r.offerNote}`}
              </p>
            )}
            {(r.status === "interested" || r.status === "declined") && (
              <details className="bg-surface border border-border rounded">
                <summary className="cursor-pointer px-3 py-2 font-display text-[10px] tracking-wider text-gold uppercase">
                  {r.status === "declined" ? "Re-offer bout" : "Offer bout"}
                </summary>
                <AdminOfferBoutForm
                  eventId={eventId}
                  athleteId={r.athleteId}
                  athleteDivision={r.athleteDivision}
                  athleteMartialArt={r.athleteMartialArt}
                  opponents={opponents.filter((o) => o.id !== r.athleteId)}
                />
              </details>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
