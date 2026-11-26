import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { reviewClubJoinRequest, cancelClubInvite } from "@/app/actions/club";
import { ClubGalleryForm } from "@/components/forms/club-gallery-form";
import { ClubCoachForm } from "@/components/forms/club-coach-form";
import { ClubWithdrawForm } from "@/components/forms/club-withdraw-form";
import { ClubTimetableImageForm } from "@/components/forms/club-timetable-image-form";
import { ClubClassesForm, type GymClassRow } from "@/components/forms/club-classes-form";
import { ClubPassesForm, type GymProductRow } from "@/components/forms/club-passes-form";
import {
  ClubInviteFighterForm,
  type FighterSearchOption,
} from "@/components/forms/club-invite-fighter-form";
import {
  ClubEventInterestForm,
  type ClubMemberOption,
  type ClubEventOption,
} from "@/components/forms/club-event-interest-form";
import { martialArtName, classDisplayName, martialArtRequiresClass } from "@/lib/martial-arts";
import { divisionDisplayName } from "@/lib/divisions";

export const metadata = { title: "Club portal" };

export default async function ClubPortalPage() {
  const session = await auth();
  if (!session?.user) redirect("/portal/sign-in");
  if (
    session.user.role !== "gym" &&
    session.user.role !== "coach" &&
    session.user.role !== "admin"
  ) {
    redirect("/portal");
  }

  // Resolve the gym owned (or coached) by this account.
  const gym = await prisma.gym.findFirst({
    where: { ownerId: Number(session.user.id) },
    include: {
      fighters: {
        include: {
          athlete: {
            include: {
              passport: true,
              rankings: true,
              disciplines: true,
            },
          },
          user: true,
        },
        orderBy: { athlete: { name: "asc" } },
      },
      joinReqs: {
        include: {
          user: true,
        },
        orderBy: { createdAt: "desc" },
      },
      photos: { orderBy: { createdAt: "desc" } },
      classes: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      products: { orderBy: { id: "asc" } },
      closures: {
        where: { status: "pending" },
        select: { id: true },
      },
    },
  });

  if (!gym) {
    return (
      <>
        <PageHeader eyebrow="Club portal" title="No club linked">
          No club is linked to this account.
        </PageHeader>
        <Container className="py-10">
          <p className="text-sm text-muted">
            Ask a W.U.C.O admin to assign you as the owner of a club record.
          </p>
        </Container>
      </>
    );
  }

  const pendingReqs = gym.joinReqs.filter((r) => r.status === "pending");
  const pastReqs = gym.joinReqs.filter((r) => r.status !== "pending");

  // Data for the "invite a fighter" and "raise event interest" sections.
  const [allFighters, pendingInvites, upcomingEvents] = await Promise.all([
    prisma.athlete.findMany({
      where: { profile: { approvalStatus: "approved" } },
      include: {
        profile: { include: { gym: { select: { name: true } } } },
        passport: true,
        disciplines: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.clubFighterInvite.findMany({
      where: { gymId: gym.id, status: "pending" },
      include: { athlete: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.event.findMany({
      where: { status: { not: "Past" } },
      select: { id: true, title: true, startsAt: true },
      orderBy: { startsAt: "asc" },
      take: 20,
    }),
  ]);

  // Only offer to invite fighters not already on this club.
  const inviteCandidates: FighterSearchOption[] = allFighters
    .filter((a) => a.profile?.gymId !== gym.id)
    .map((a) => {
      const primary = a.disciplines.find((d) => d.isPrimary === 1) ?? a.disciplines[0];
      return {
        id: a.id,
        name: a.name,
        fighterNo: a.passport?.fighterNo ?? null,
        division: a.division ?? "",
        martialArt: primary?.martialArt ?? a.martialArt ?? "",
        gymName: a.profile?.gym?.name ?? null,
      };
    });

  const members: ClubMemberOption[] = gym.fighters
    .filter((f) => f.approvalStatus === "approved")
    .map((f) => ({ id: f.athlete.id, name: f.athlete.name }));
  const events: ClubEventOption[] = upcomingEvents.map((e) => ({
    id: e.id,
    title: e.title,
    startsAt: e.startsAt ?? null,
  }));

  // Flatten every ranked athlete at this club into one list.
  const rankedRows: {
    athleteId: number;
    name: string;
    fighterNo: string | null;
    position: number;
    division: string;
    record: string;
  }[] = [];
  for (const f of gym.fighters) {
    for (const r of f.athlete.rankings) {
      rankedRows.push({
        athleteId: f.athlete.id,
        name: f.athlete.name,
        fighterNo: f.athlete.passport?.fighterNo ?? null,
        position: r.position,
        division: r.division,
        record: `${f.athlete.wins}-${f.athlete.losses}-${f.athlete.draws}`,
      });
    }
  }
  rankedRows.sort((a, b) => {
    if (a.division !== b.division) return a.division.localeCompare(b.division);
    return a.position - b.position;
  });

  return (
    <>
      <PageHeader eyebrow="Club portal" title={gym.name}>
        Manage {gym.name} — review join requests, keep track of your fighters,
        and share club photos.
      </PageHeader>
      <Container className="py-10 space-y-8">
        {gym.slug && (
          <div className="flex flex-wrap gap-3 text-xs">
            <Link
              href={`/clubs/${gym.slug}`}
              target="_blank"
              className="text-gold border-b border-gold pb-0.5 font-display tracking-wider"
            >
              View public club page ↗
            </Link>
            <Link
              href="/portal/profile"
              className="text-muted hover:text-white underline"
            >
              Edit your coach profile
            </Link>
          </div>
        )}

        {/* --- Pending join requests ---------------------------------- */}
        <section className="bg-surface border border-gold/40 rounded-xl p-5">
          <header className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="font-display text-lg text-white tracking-wider">
              Pending join requests
            </h2>
            <span className="text-xs text-muted">
              {pendingReqs.length === 0
                ? "No one waiting"
                : `${pendingReqs.length} awaiting review`}
            </span>
          </header>
          {pendingReqs.length === 0 ? (
            <p className="text-xs text-muted">
              You&apos;ll see fighter join requests here once they apply from
              your public club page.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {pendingReqs.map((r) => (
                <li key={r.id} className="py-3 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm text-white tracking-wider">
                      {r.user.name}
                    </p>
                    <p className="text-xs text-muted">
                      {r.user.email} · {r.createdAt.toISOString().slice(0, 10)}
                    </p>
                    {r.reviewNote && (
                      <p className="text-xs text-white/80 mt-1 whitespace-pre-wrap">
                        “{r.reviewNote}”
                      </p>
                    )}
                  </div>
                  <form action={reviewClubJoinRequest} className="flex gap-2">
                    <input type="hidden" name="request_id" value={r.id} />
                    <input type="hidden" name="decision" value="approved" />
                    <button className="bg-emerald text-white px-3 py-1.5 text-xs font-display tracking-wider hover:bg-emerald-hi rounded">
                      APPROVE
                    </button>
                  </form>
                  <form action={reviewClubJoinRequest} className="flex gap-2">
                    <input type="hidden" name="request_id" value={r.id} />
                    <input type="hidden" name="decision" value="rejected" />
                    <button className="border border-red-500 text-red-200 px-3 py-1.5 text-xs font-display tracking-wider hover:bg-red-500 hover:text-white rounded">
                      DECLINE
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {pastReqs.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[11px] font-display tracking-wider text-muted uppercase">
                Past decisions ({pastReqs.length})
              </summary>
              <ul className="mt-2 space-y-1 text-xs">
                {pastReqs.map((r) => (
                  <li key={r.id} className="text-muted">
                    <span className="text-white/80">{r.user.name}</span> ·{" "}
                    <span
                      className={
                        r.status === "approved" ? "text-emerald-300" : "text-red-300"
                      }
                    >
                      {r.status}
                    </span>
                    {r.reviewedAt && (
                      <span> · {r.reviewedAt.toISOString().slice(0, 10)}</span>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        {/* --- Invite a fighter to join the club -------------------- */}
        <section className="bg-surface border border-gold/40 rounded-xl p-5">
          <header className="mb-3">
            <h2 className="font-display text-lg text-white tracking-wider">
              Invite a fighter
            </h2>
            <p className="text-xs text-muted mt-1">
              Search approved fighters and send an invite to affiliate with
              {" "}{gym.name}. They&apos;ll appear here once they accept.
            </p>
          </header>
          <ClubInviteFighterForm fighters={inviteCandidates} />
          {pendingInvites.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="font-display text-[10px] tracking-wider text-gold uppercase mb-2">
                Pending invites ({pendingInvites.length})
              </p>
              <ul className="divide-y divide-border/60">
                {pendingInvites.map((i) => (
                  <li key={i.id} className="py-2 flex items-center gap-3 text-sm">
                    <span className="flex-1 text-white">
                      {i.athlete.name}
                      <span className="block text-[11px] text-muted">
                        sent {i.createdAt.toISOString().slice(0, 10)}
                      </span>
                    </span>
                    <form action={cancelClubInvite}>
                      <input type="hidden" name="invite_id" value={i.id} />
                      <button
                        type="submit"
                        className="text-[11px] text-red-400 hover:text-red-300 underline"
                      >
                        cancel
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* --- Raise event interest on a fighter's behalf ----------- */}
        <section className="bg-surface border border-gold/40 rounded-xl p-5">
          <header className="mb-3">
            <h2 className="font-display text-lg text-white tracking-wider">
              Raise event interest
            </h2>
            <p className="text-xs text-muted mt-1">
              Flag one of your fighters for an upcoming event. The fighter
              must confirm before the W.U.C.O admin sees the interest.
            </p>
          </header>
          <ClubEventInterestForm members={members} events={events} />
        </section>

        {/* --- Fighters affiliated with the club ---------------------- */}
        <section className="bg-surface border border-border rounded-xl p-5">
          <header className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="font-display text-lg text-white tracking-wider">
              Your fighters
            </h2>
            <span className="text-xs text-muted">
              {gym.fighters.length === 0
                ? "No fighters yet"
                : `${gym.fighters.length} registered`}
            </span>
          </header>
          {gym.fighters.length === 0 ? (
            <EmptyState
              title="No fighters registered yet"
              description="Fighters join by requesting from your public club page."
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {gym.fighters.map((f) => {
                const a = f.athlete;
                return (
                  <li
                    key={a.id}
                    className="py-3 flex flex-wrap items-center gap-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-white tracking-wider">
                        {a.name}
                        {a.passport?.fighterNo && (
                          <span className="ml-2 text-gold text-xs">
                            {a.passport.fighterNo}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted">
                        {martialArtName(a.martialArt) || "—"}
                        {martialArtRequiresClass(a.martialArt) &&
                          ` · ${classDisplayName(a.martialArt, a.classCode) || "no class"}`}
                        {" · "}
                        {divisionDisplayName(a.gender, a.division) || "—"}
                        {" · "}
                        <span className="text-white">
                          {a.wins}-{a.losses}-{a.draws}
                        </span>
                      </p>
                    </div>
                    <span
                      className={`inline-block px-2 py-1 text-[10px] font-display tracking-wider rounded-full ${
                        f.approvalStatus === "approved"
                          ? "bg-emerald/20 text-emerald-200"
                          : "bg-gold/20 text-gold"
                      }`}
                    >
                      {f.approvalStatus.replace("_", " ").toUpperCase()}
                    </span>
                    {a.passport?.fighterNo && (
                      <Link
                        href={`/passport/${a.passport.fighterNo}`}
                        target="_blank"
                        className="text-[11px] text-gold hover:underline"
                      >
                        passport ↗
                      </Link>
                    )}
                    <Link
                      href={`/fighters/${a.id}`}
                      target="_blank"
                      className="text-[11px] text-gold hover:underline"
                    >
                      profile ↗
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* --- Club rankings view ------------------------------------ */}
        <section className="bg-surface border border-border rounded-xl p-5">
          <header className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="font-display text-lg text-white tracking-wider">
              Your fighters&apos; rankings
            </h2>
            <span className="text-xs text-muted">
              {rankedRows.length === 0
                ? "No rankings yet"
                : `${rankedRows.length} ranked entries`}
            </span>
          </header>
          {rankedRows.length === 0 ? (
            <p className="text-xs text-muted">
              Once a W.U.C.O admin assigns rankings to your fighters they
              appear here, grouped by division.
            </p>
          ) : (
            <ul className="space-y-4">
              {Array.from(new Set(rankedRows.map((r) => r.division))).map((div) => (
                <li key={div} className="border border-border rounded-lg p-3">
                  <p className="font-display text-xs tracking-wider text-gold uppercase mb-2">
                    {divisionDisplayName(null, div)}
                  </p>
                  <ol className="divide-y divide-border/60">
                    {rankedRows
                      .filter((r) => r.division === div)
                      .map((r) => (
                        <li
                          key={`${r.athleteId}:${r.division}`}
                          className="py-2 flex items-center gap-3 text-sm"
                        >
                          <span className="font-display text-xl text-gold w-8 text-center">
                            {r.position}
                          </span>
                          <span className="flex-1 text-white">
                            {r.name}
                            <span className="block text-xs text-muted">
                              {r.fighterNo ?? "—"} · {r.record}
                            </span>
                          </span>
                          <Link
                            href={`/fighters/${r.athleteId}`}
                            target="_blank"
                            className="text-[11px] text-gold hover:underline"
                          >
                            view ↗
                          </Link>
                        </li>
                      ))}
                  </ol>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* --- Timetable + classes + passes (active clubs only) ------- */}
        {gym.status === "active" ? (
          <>
            <section className="bg-surface border border-border rounded-xl p-5">
              <header className="mb-4">
                <h2 className="font-display text-lg text-white tracking-wider">
                  Weekly timetable image
                </h2>
                <p className="text-xs text-muted mt-1">
                  Shows at the top of your public club page. Use the
                  structured class list below for bookings.
                </p>
              </header>
              <ClubTimetableImageForm
                initialUrl={gym.timetableImageUrl ?? ""}
              />
            </section>

            <section className="bg-surface border border-border rounded-xl p-5">
              <header className="mb-4">
                <h2 className="font-display text-lg text-white tracking-wider">
                  Weekly classes
                </h2>
                <p className="text-xs text-muted mt-1">
                  Each class becomes a bookable slot on your public page.
                </p>
              </header>
              <ClubClassesForm
                classes={gym.classes.map<GymClassRow>((c) => ({
                  id: c.id,
                  title: c.title,
                  discipline: c.discipline,
                  dayOfWeek: c.dayOfWeek,
                  startTime: c.startTime,
                  durationMinutes: c.durationMinutes,
                  capacity: c.capacity,
                  perClassPriceCents: c.perClassPriceCents ?? null,
                  revolutUrl: c.revolutUrl,
                  colour: c.colour,
                }))}
              />
            </section>

            <section className="bg-surface border border-border rounded-xl p-5">
              <header className="mb-4">
                <h2 className="font-display text-lg text-white tracking-wider">
                  Passes &amp; pricing
                </h2>
                <p className="text-xs text-muted mt-1">
                  Day / week / month passes and per-class drop-in. Add a
                  Revolut URL on each to accept payments.
                </p>
              </header>
              <ClubPassesForm
                products={gym.products.map<GymProductRow>((p) => ({
                  id: p.id,
                  kind: p.kind,
                  title: p.title,
                  priceCents: p.priceCents,
                  revolutUrl: p.revolutUrl,
                  active: p.active,
                }))}
              />
            </section>
          </>
        ) : (
          <section className="bg-surface border border-gold/40 rounded-xl p-5">
            <h2 className="font-display text-lg text-white tracking-wider mb-2">
              Timetable &amp; bookings
            </h2>
            <p className="text-xs text-muted">
              Your club is {gym.status.replace("_", " ")}. Once a W.U.C.O admin
              approves your club onto the federation, this section unlocks and
              you can upload a timetable image, add structured classes, and
              configure passes.
            </p>
          </section>
        )}

        {/* --- Head coach profile ------------------------------------ */}
        <section className="bg-surface border border-border rounded-xl p-5">
          <header className="mb-4">
            <h2 className="font-display text-lg text-white tracking-wider">
              Head coach profile
            </h2>
            <p className="text-xs text-muted mt-1">
              Edit the coach information captured at onboarding. Changes are
              saved to {gym.name}.
            </p>
          </header>
          <ClubCoachForm
            initialValues={{
              coachName: gym.coachName ?? "",
              coachRank: gym.coachRank ?? "",
              coachYearsTraining: gym.coachYearsTraining ?? null,
              coachStyle: gym.coachStyle ?? "",
              coachLastGradeYear: gym.coachLastGradeYear ?? null,
              coachPhone: gym.coachPhone ?? "",
              coachEmail: gym.coachEmail ?? "",
              coachQualifications: gym.coachQualifications ?? "",
              coachYearsCoaching: gym.coachYearsCoaching ?? null,
              coachCertifications: gym.coachCertifications ?? "",
              coachFirstAidExpiry: gym.coachFirstAidExpiry ?? "",
              coachSafeguarding: gym.coachSafeguarding ?? "",
              coachGardaVetting: gym.coachGardaVetting ?? "",
              coachPhotoUrl: gym.coachPhotoUrl ?? null,
            }}
          />
        </section>

        {/* --- Club gallery ------------------------------------------ */}
        <section className="bg-surface border border-border rounded-xl p-5">
          <header className="flex items-baseline justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-lg text-white tracking-wider">
                Club gallery
              </h2>
              <p className="text-xs text-muted mt-1">
                Photos appear on your public club page.
              </p>
            </div>
          </header>
          <ClubGalleryForm
            initialPhotos={gym.photos.map((p) => ({
              id: p.id,
              url: p.url,
              caption: p.caption,
            }))}
          />
        </section>

        {/* --- Danger zone: withdraw from W.U.C.O ------------------- */}
        <section className="bg-surface border border-red-500/40 rounded-xl p-5">
          <header className="mb-3">
            <h2 className="font-display text-lg text-red-200 tracking-wider">
              Danger zone
            </h2>
            <p className="text-xs text-muted mt-1">
              Withdraw {gym.name} from W.U.C.O affiliation. A W.U.C.O admin
              reviews and processes every request — your club stays active
              until then. Once closed, your public page is unpublished and
              every affiliated fighter is unlinked.
            </p>
          </header>
          <ClubWithdrawForm pendingAlready={gym.closures.length > 0} />
        </section>
      </Container>
    </>
  );
}
