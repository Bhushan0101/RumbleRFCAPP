import { notFound } from "next/navigation";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { BookingDialog } from "@/components/site/booking-dialog";
import { JoinClubBlock } from "@/components/site/join-club-block";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const KIND_LABEL: Record<string, string> = {
  day_pass: "Day pass",
  weekly_pass: "Weekly pass",
  monthly_pass: "Monthly pass",
  per_class: "Per-class drop-in",
};

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  const gym = await prisma.gym.findUnique({ where: { slug } });
  return gym ? { title: gym.name } : { title: "Club not found" };
}

export default async function GymPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [session, gym] = await Promise.all([
    auth(),
    prisma.gym.findUnique({
      where: { slug },
      include: {
        products: true,
        classes: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
        photos: { orderBy: { createdAt: "desc" } },
      },
    }),
  ]);
  if (!gym || gym.status !== "active") notFound();

  // Viewer's join-request state (only meaningful for signed-in fighters).
  let joinState: {
    status: "none" | "pending" | "approved" | "rejected" | "already_at";
  } | null = null;
  if (session?.user?.id && session.user.role === "fighter") {
    const profile = await prisma.fighterProfile.findFirst({
      where: { userId: Number(session.user.id) },
      select: { gymId: true, approvalStatus: true },
    });
    if (profile?.approvalStatus === "approved") {
      if (profile.gymId === gym.id) {
        joinState = { status: "already_at" };
      } else {
        const req = await prisma.gymJoinRequest.findUnique({
          where: {
            gymId_userId: { gymId: gym.id, userId: Number(session.user.id) },
          },
          select: { status: true },
        });
        if (!req) joinState = { status: "none" };
        else if (req.status === "pending") joinState = { status: "pending" };
        else if (req.status === "approved") joinState = { status: "approved" };
        else joinState = { status: "rejected" };
      }
    }
  }

  const classesByDay = DAYS.map((_, i) =>
    gym.classes.filter((c) => c.dayOfWeek === i),
  );
  const money = (c: number) =>
    (c / 100).toLocaleString("en-IE", { style: "currency", currency: "EUR" });

  return (
    <>
      <PageHeader eyebrow={gym.city || "W.U.C.O affiliated club"} title={gym.name}>
        {gym.about}
      </PageHeader>
      <Container className="py-10 space-y-6">
        {joinState && (
          <JoinClubBlock gymId={gym.id} gymName={gym.name} status={joinState.status} />
        )}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
          <section className="bg-surface border border-border p-6">
            <h2 className="font-display text-xl text-white tracking-wider mb-4">
              Weekly timetable
            </h2>
            {gym.timetableImageUrl && (
              <div className="relative aspect-[16/9] mb-4 bg-surface-3">
                <Image
                  src={gym.timetableImageUrl}
                  alt={`${gym.name} timetable`}
                  fill
                  className="object-contain"
                />
              </div>
            )}
            {gym.classes.length === 0 ? (
              <p className="text-sm text-muted">
                Structured class timetable has not been published.
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                {DAYS.map((d, i) => (
                  <div key={d} className="flex flex-col gap-1">
                    <h3 className="font-display text-[10px] tracking-wider text-gold text-center py-2 bg-surface-3 border-b border-gold">
                      {d.slice(0, 3)}
                    </h3>
                    {classesByDay[i].length === 0 ? (
                      <div className="bg-surface-3/40 p-2 text-center text-muted text-xs">
                        —
                      </div>
                    ) : (
                      classesByDay[i].map((c) => (
                        <div
                          key={c.id}
                          className="bg-surface-3 border border-border p-2 text-xs"
                        >
                          <p className="font-display text-[9px] tracking-wider text-gold">
                            {c.startTime}
                          </p>
                          <p className="font-display text-white tracking-wider mt-1">
                            {c.title}
                          </p>
                          <p className="text-muted text-[10px] mt-0.5">
                            {c.discipline} · {c.durationMinutes}m
                          </p>
                          <BookingDialog
                            classId={c.id}
                            classTitle={c.title}
                            day={DAYS[c.dayOfWeek]}
                            time={c.startTime}
                            revolutUrl={c.revolutUrl}
                            price={c.perClassPriceCents}
                          />
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
          <aside className="bg-surface border border-border p-6">
            <h2 className="font-display text-xl text-white tracking-wider mb-4">
              Passes &amp; bookings
            </h2>
            {gym.products.length === 0 ? (
              <p className="text-sm text-muted">
                No pricing products published.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {gym.products.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between py-3 text-sm"
                  >
                    <div>
                      <p className="text-white">{p.title}</p>
                      <p className="text-muted text-xs">
                        {KIND_LABEL[p.kind] ?? p.kind}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-display text-xl text-gold">
                        {money(p.priceCents)}
                      </span>
                      {p.revolutUrl && (
                        <a
                          href={p.revolutUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-gold text-bg px-3 py-2 font-display text-[10px] tracking-wider hover:bg-gold-hi"
                        >
                          BUY →
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>

        {(gym.coachName || gym.coachPhotoUrl) && (
          <section className="bg-surface border border-border rounded-2xl p-6">
            <h2 className="font-display text-xl text-white tracking-wider mb-4">
              Head coach
            </h2>
            <div className="flex flex-col sm:flex-row gap-5">
              {gym.coachPhotoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={gym.coachPhotoUrl}
                  alt={gym.coachName || "Head coach"}
                  className="w-40 h-40 object-cover rounded-xl border border-gold/40 shrink-0"
                />
              )}
              <div className="flex-1 space-y-2 text-sm">
                {gym.coachName && (
                  <p className="font-display text-xl text-white tracking-wider">
                    {gym.coachName}
                    {gym.coachRank && (
                      <span className="ml-2 text-xs text-gold">
                        {gym.coachRank}
                      </span>
                    )}
                  </p>
                )}
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  {gym.coachStyle && (
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-muted">Style</dt>
                      <dd className="text-white">{gym.coachStyle}</dd>
                    </div>
                  )}
                  {gym.coachYearsTraining != null && (
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-muted">
                        Years training
                      </dt>
                      <dd className="text-white">{gym.coachYearsTraining}</dd>
                    </div>
                  )}
                  {gym.coachYearsCoaching != null && (
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-muted">
                        Years coaching
                      </dt>
                      <dd className="text-white">{gym.coachYearsCoaching}</dd>
                    </div>
                  )}
                  {gym.coachLastGradeYear != null && (
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-muted">
                        Last grade
                      </dt>
                      <dd className="text-white">{gym.coachLastGradeYear}</dd>
                    </div>
                  )}
                </dl>
                {gym.coachQualifications && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted mt-2">
                      Qualifications
                    </p>
                    <p className="text-white/85 whitespace-pre-wrap text-xs">
                      {gym.coachQualifications}
                    </p>
                  </div>
                )}
                {gym.coachCertifications && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted mt-2">
                      Certifications
                    </p>
                    <p className="text-white/85 whitespace-pre-wrap text-xs">
                      {gym.coachCertifications}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {gym.photos.length > 0 && (
          <section className="bg-surface border border-border rounded-2xl p-6">
            <h2 className="font-display text-xl text-white tracking-wider mb-4">
              Gallery
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {gym.photos.map((p) => (
                <figure
                  key={p.id}
                  className="relative aspect-square rounded-lg overflow-hidden border border-border bg-black/40"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={p.caption || gym.name}
                    className="w-full h-full object-cover"
                  />
                  {p.caption && (
                    <figcaption className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[11px] px-2 py-1 line-clamp-2">
                      {p.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </section>
        )}
      </Container>
    </>
  );
}
