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
} from "@/app/actions/admin-editor";

export const metadata = { title: "Admin · Events & bouts" };

export default async function AdminEventsPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/portal/sign-in");

  const [events, fighters] = await Promise.all([
    prisma.event.findMany({
      orderBy: { startsAt: "desc" },
      include: {
        _count: { select: { bouts: true, registrations: true } },
      },
    }),
    prisma.athlete.findMany({
      where: { profile: { approvalStatus: "approved" } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader eyebrow="Administrator" title="Events & bouts">
        Create and edit events, publish fight cards, record results. A result
        auto-updates the athletes' win/loss/draw record.
      </PageHeader>
      <Container className="py-10 space-y-6">
        <Link
          href="/portal"
          className="text-xs text-gold font-display tracking-wider"
        >
          ← Back to dashboard
        </Link>

        {/* New event */}
        <section className="bg-surface border border-border p-5">
          <h2 className="font-display text-xl text-white tracking-wider mb-4">
            Create event
          </h2>
          <form action={saveEvent} className="grid gap-3 md:grid-cols-3">
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
                <option>Past</option>
              </select>
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
              className="bg-surface border border-border p-5 space-y-4"
            >
              <header className="flex flex-wrap items-start justify-between gap-3">
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
                <span
                  className={`inline-block px-2 py-1 text-[10px] tracking-wider font-display ${
                    e.status === "Upcoming"
                      ? "bg-gold text-bg"
                      : "bg-border text-white"
                  }`}
                >
                  {e.status.toUpperCase()}
                </span>
              </header>

              <div className="grid gap-4 md:grid-cols-2">
                <details className="bg-bg border border-border">
                  <summary className="cursor-pointer px-4 py-3 font-display text-xs tracking-wider text-gold uppercase">
                    Edit event
                  </summary>
                  <form action={saveEvent} className="p-4 space-y-3">
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
                        <option>Past</option>
                      </select>
                    </label>
                    <div className="flex gap-2">
                      <button className="bg-emerald text-white px-4 py-2 text-xs font-display tracking-wider hover:bg-emerald-hi">
                        SAVE
                      </button>
                    </div>
                  </form>
                </details>

                <details className="bg-bg border border-border">
                  <summary className="cursor-pointer px-4 py-3 font-display text-xs tracking-wider text-gold uppercase">
                    + Record a bout result
                  </summary>
                  <form action={recordBoutResult} className="p-4 space-y-3">
                    <input type="hidden" name="event_id" value={e.id} />
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
              </div>

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
