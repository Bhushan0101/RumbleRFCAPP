import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { FighterProfileForm } from "@/components/forms/fighter-profile-form";
import { RequestCorrectionButton } from "@/components/forms/request-correction-button";
import { PortraitCardControls } from "@/components/forms/portrait-card-controls";
import { FighterGalleryForm } from "@/components/forms/fighter-gallery-form";
import { InjuriesForm } from "@/components/forms/injuries-form";
import { VerificationRequestsPanel } from "@/components/forms/verification-requests-panel";
import { DeleteAccountCard } from "@/components/forms/delete-account-card";
import { Trophy, QrCode } from "lucide-react";
import { martialArtName, classDisplayName, martialArtRequiresClass } from "@/lib/martial-arts";
import { divisionDisplayName } from "@/lib/divisions";
import { completenessScore, completenessSteps } from "@/lib/completeness";
import { respondToClubInvite } from "@/app/actions/club";

export const metadata = { title: "My profile" };

export default async function MyProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/portal/sign-in");

  const profile = await prisma.fighterProfile.findFirst({
    where: { userId: session.user.id },
    include: {
      athlete: {
        include: {
          passport: true,
          disciplines: true,
          fightHistory: { orderBy: { fightDate: "desc" } },
          photos: { orderBy: { createdAt: "desc" } },
        },
      },
      user: {
        include: {
          verifications: {
            orderBy: { createdAt: "desc" },
          },
        },
      },
      gym: true,
    },
  });

  // Inbound club invites (approved fighters only; pending_approval users can't
  // belong to a club anyway).
  const clubInvites = profile
    ? await prisma.clubFighterInvite.findMany({
        where: { athleteId: profile.athleteId, status: "pending" },
        include: { gym: { select: { id: true, name: true, city: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // Outbound join requests (fighter → club) that haven't been resolved yet.
  const pendingJoinRequests = profile
    ? await prisma.gymJoinRequest.findMany({
        where: { userId: session.user.id, status: "pending" },
        include: { gym: { select: { id: true, name: true, slug: true, city: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  if (!profile) {
    return (
      <>
        <PageHeader eyebrow="Member" title="My profile">
          No fighter profile is linked to this account yet.
        </PageHeader>
        <Container className="py-10">
          <Link
            href="/portal"
            className="text-xs text-gold font-display tracking-wider"
          >
            ← Back to dashboard
          </Link>
        </Container>
      </>
    );
  }

  const isApproved = profile.approvalStatus === "approved";
  const hasPortrait = !!profile.athlete.portraitUrl;
  const injuryAnswered = !!profile.injuryAnsweredAt;
  const hasSocialLink =
    !!profile.athlete.instagramHandle ||
    !!profile.athlete.facebookUrl ||
    !!profile.athlete.tiktokHandle;
  const score = completenessScore({
    approved: isApproved,
    hasPortrait,
    injuryAnswered,
    hasSocialLink,
  });
  const steps = completenessSteps({
    approved: isApproved,
    hasPortrait,
    injuryAnswered,
    hasSocialLink,
  });

  return (
    <>
      <PageHeader eyebrow="Member" title="My profile">
        Keep your profile up to date. Approved baseline is 50% — add a photo,
        injury info and a social link to reach 100%.
      </PageHeader>
      <Container className="py-10">
        <Link
          href="/portal"
          className="text-xs text-gold font-display tracking-wider mb-6 inline-block"
        >
          ← Back to dashboard
        </Link>

        {isApproved && (
          <div className="bg-surface border border-border rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display text-sm text-gold tracking-wider uppercase">
                Profile completeness
              </h3>
              <span className="font-display text-lg text-white">{score}%</span>
            </div>
            <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald to-gold transition-all"
                style={{ width: `${score}%` }}
              />
            </div>
            <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-y-1 text-xs">
              {steps.map((s) => (
                <li
                  key={s.label}
                  className={s.done ? "text-emerald-300" : "text-muted"}
                >
                  {s.done ? "✓" : "○"} {s.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Fighter card side panel */}
          <aside className="space-y-5">
            <div className="bg-gradient-to-br from-[#0a2f23] via-[#0b3d2e] to-[#07251b] rounded-2xl border-2 border-gold/50 p-5 shadow-xl">
              <p className="font-display text-[10px] tracking-[0.4em] text-gold uppercase">
                W.U.C.O Fighter No
              </p>
              <p className="font-display text-3xl text-white tracking-wider mt-1">
                {profile.athlete.passport?.fighterNo ?? "— pending —"}
              </p>
              <div className="my-4 h-px bg-gold/30" />
              {profile.athlete.portraitUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.athlete.portraitUrl}
                  alt=""
                  className="w-full aspect-[4/5] object-cover rounded-xl mb-3 border border-gold/30"
                />
              ) : (
                <div className="w-full aspect-[4/5] bg-black/40 border border-dashed border-gold/40 rounded-xl mb-3 grid place-items-center">
                  <span className="font-display text-6xl text-muted/60">
                    {profile.athlete.name[0]?.toUpperCase()}
                  </span>
                </div>
              )}
              {isApproved && (
                <PortraitCardControls hasPortrait={hasPortrait} />
              )}
              <p className="font-display text-xl text-white tracking-wider">
                {profile.athlete.name}
              </p>
              {profile.athlete.nickname && (
                <p className="text-xs text-muted mt-1">
                  “{profile.athlete.nickname}”
                </p>
              )}
              <p className="text-xs text-muted mt-2">
                {martialArtName(profile.athlete.martialArt) || "—"}
                {martialArtRequiresClass(profile.athlete.martialArt) && (
                  <> · {classDisplayName(profile.athlete.martialArt, profile.athlete.classCode) || "No class"}</>
                )}
                {profile.athlete.disciplines.length > 1 && (
                  <span className="ml-1 text-gold">+{profile.athlete.disciplines.length - 1} more</span>
                )}
              </p>
              <p className="text-xs text-muted">
                {divisionDisplayName(profile.athlete.gender, profile.athlete.division) || "—"} · {profile.athlete.country}
              </p>
              {profile.athlete.disciplines.length > 1 && (
                <ul className="mt-3 space-y-1 text-[11px] border-t border-border pt-3">
                  {[...profile.athlete.disciplines]
                    .sort((a, b) => b.isPrimary - a.isPrimary)
                    .map((d) => (
                      <li key={d.martialArt} className="flex justify-between text-white">
                        <span>
                          {martialArtName(d.martialArt)}
                          {d.classCode && martialArtRequiresClass(d.martialArt) && (
                            <span className="text-gold ml-1">· {d.classCode}</span>
                          )}
                          {d.isPrimary === 1 && (
                            <span className="ml-1.5 inline-block bg-gold text-bg text-[9px] px-1.5 py-0.5 rounded-full">
                              P
                            </span>
                          )}
                        </span>
                        <span className="text-muted">
                          {d.wins}-{d.losses}-{d.draws}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <RecordTile value={profile.athlete.wins} label="W" />
                <RecordTile value={profile.athlete.losses} label="L" />
                <RecordTile value={profile.athlete.draws} label="D" />
              </div>
              <p className="text-[10px] text-muted mt-3 text-center">
                Status:{" "}
                <span className="font-display tracking-wider text-emerald">
                  {profile.approvalStatus.replace("_", " ")}
                </span>
              </p>
            </div>

            {profile.athlete.passport?.fighterNo ? (
              <Link
                href={`/passport/${profile.athlete.passport.fighterNo}`}
                target="_blank"
                className="flex items-center justify-center gap-2 bg-gold text-bg py-3 font-display font-bold text-xs tracking-wider rounded-full hover:bg-gold-hi"
              >
                <QrCode className="size-4" />
                View digital passport
              </Link>
            ) : (
              <p className="text-xs text-muted border border-dashed border-gold/40 rounded-xl p-3 text-center">
                Your digital passport will be issued when an administrator
                approves your profile.
              </p>
            )}
            <Link
              href="/rankings"
              className="flex items-center justify-center gap-2 border border-gold text-white py-3 font-display font-bold text-xs tracking-wider rounded-full hover:bg-gold hover:text-bg"
            >
              <Trophy className="size-4" />
              View rankings
            </Link>
            <RequestCorrectionButton />
          </aside>

          <div className="space-y-6">
            {clubInvites.length > 0 && (
              <section className="bg-surface border-2 border-gold/60 rounded-2xl p-5 md:p-6">
                <h2 className="font-display text-xl text-white tracking-wider mb-2">
                  Club invites ({clubInvites.length})
                </h2>
                <p className="text-xs text-muted mb-4">
                  A club has invited you to affiliate. Accepting links your
                  W.U.C.O profile to that club.
                </p>
                <ul className="divide-y divide-border/60">
                  {clubInvites.map((inv) => (
                    <li key={inv.id} className="py-3 flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-sm text-white tracking-wider">
                          {inv.gym.name}
                          {inv.gym.city && (
                            <span className="ml-2 text-[11px] text-muted font-sans tracking-normal">
                              · {inv.gym.city}
                            </span>
                          )}
                        </p>
                        {inv.note && (
                          <p className="text-xs text-white/80 mt-1 whitespace-pre-wrap">
                            “{inv.note}”
                          </p>
                        )}
                      </div>
                      <form action={respondToClubInvite} className="flex gap-2">
                        <input type="hidden" name="invite_id" value={inv.id} />
                        <input type="hidden" name="decision" value="accept" />
                        <button
                          type="submit"
                          className="bg-emerald text-white px-3 py-1.5 text-xs font-display tracking-wider hover:bg-emerald-hi rounded"
                        >
                          ACCEPT
                        </button>
                      </form>
                      <form action={respondToClubInvite} className="flex gap-2">
                        <input type="hidden" name="invite_id" value={inv.id} />
                        <input type="hidden" name="decision" value="decline" />
                        <button
                          type="submit"
                          className="border border-red-500 text-red-200 px-3 py-1.5 text-xs font-display tracking-wider hover:bg-red-500 hover:text-white rounded"
                        >
                          DECLINE
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {isApproved && (
              <section className="bg-surface border border-border rounded-2xl p-5 md:p-6">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h2 className="font-display text-xl text-white tracking-wider">
                      Your club
                    </h2>
                    <p className="text-xs text-muted mt-1">
                      Your gym affiliation on W.U.C.O. You can change this any
                      time.
                    </p>
                  </div>
                  <Link
                    href="/clubs"
                    className="shrink-0 text-xs text-gold font-display tracking-wider underline hover:text-gold-hi"
                  >
                    Browse clubs →
                  </Link>
                </div>
                {profile.gym ? (
                  <div className="flex items-center justify-between gap-3 border border-border rounded-lg px-4 py-3">
                    <div>
                      <p className="font-display text-white tracking-wider">
                        {profile.gym.name}
                      </p>
                      {profile.gym.city && (
                        <p className="text-[11px] text-muted mt-0.5">
                          {profile.gym.city}
                        </p>
                      )}
                    </div>
                    {profile.gym.slug && (
                      <Link
                        href={`/clubs/${profile.gym.slug}`}
                        className="text-[11px] text-gold hover:underline"
                      >
                        view ↗
                      </Link>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted border border-dashed border-border rounded-lg px-4 py-3">
                    You&apos;re not affiliated with a club yet. Browse clubs and
                    ask to join — the club admin approves.
                  </p>
                )}
                {pendingJoinRequests.length > 0 && (
                  <div className="mt-3">
                    <p className="font-display text-[10px] tracking-wider text-gold uppercase mb-1">
                      Awaiting club approval
                    </p>
                    <ul className="space-y-1 text-xs text-white/80">
                      {pendingJoinRequests.map((r) => (
                        <li key={r.id}>
                          {r.gym.name}
                          {r.gym.city ? ` · ${r.gym.city}` : ""}
                          <span className="ml-2 text-[10px] font-display tracking-wider text-gold uppercase">
                            Pending
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            <section className="bg-surface border border-border rounded-2xl p-6">
              <h2 className="font-display text-2xl text-white tracking-wider mb-5">
                Edit your details
              </h2>
              <FighterProfileForm
                initialName={profile.athlete.name}
                initialNickname={profile.athlete.nickname ?? ""}
                initialCountry={profile.athlete.country ?? ""}
                initialBio={profile.athlete.biography ?? ""}
                initialInstagram={profile.athlete.instagramHandle ?? ""}
                initialFacebook={profile.athlete.facebookUrl ?? ""}
                initialTiktok={profile.athlete.tiktokHandle ?? ""}
              />
            </section>

            {isApproved && (
              <>
                <section className="bg-surface border border-border rounded-2xl p-6">
                  <h2 className="font-display text-2xl text-white tracking-wider mb-2">
                    Photo gallery
                  </h2>
                  <p className="text-xs text-muted mb-5">
                    Share training, event or weigh-in photos. These appear on
                    your public fighter profile.
                  </p>
                  <FighterGalleryForm
                    initialPhotos={profile.athlete.photos.map((p) => ({
                      id: p.id,
                      url: p.url,
                      caption: p.caption,
                    }))}
                  />
                </section>

                <section className="bg-surface border border-border rounded-2xl p-6">
                  <h2 className="font-display text-2xl text-white tracking-wider mb-2">
                    Injuries
                  </h2>
                  <p className="text-xs text-muted mb-5">
                    Help W.U.C.O admins and medics with current injuries or
                    recovery notes.
                  </p>
                  <InjuriesForm
                    initialHasInjuries={profile.hasInjuries === 1}
                    initialDetails={profile.injuriesDetails}
                  />
                </section>

                <VerificationRequestsPanel
                  items={(profile.user?.verifications ?? []).map((v) => ({
                    id: v.id,
                    body: v.body,
                    status: v.status as "pending" | "verified" | "rejected",
                    adminNote: v.adminNote,
                    createdAt: v.createdAt.toISOString(),
                    verifiedAt: v.verifiedAt ? v.verifiedAt.toISOString() : null,
                  }))}
                />
              </>
            )}
          </div>
        </div>

        <div className="mt-10 max-w-2xl mx-auto">
          <DeleteAccountCard />
        </div>
      </Container>
    </>
  );
}

function RecordTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-black/30 border border-gold/30 rounded-lg py-2">
      <div className="font-display text-2xl text-white">{value}</div>
      <div className="text-[10px] tracking-wider text-gold">{label}</div>
    </div>
  );
}
