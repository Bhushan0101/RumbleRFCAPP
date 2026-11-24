import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { FighterProfileForm } from "@/components/forms/fighter-profile-form";
import { RequestCorrectionButton } from "@/components/forms/request-correction-button";
import { PortraitForm } from "@/components/forms/portrait-form";
import { InjuriesForm } from "@/components/forms/injuries-form";
import { VerificationRequestsPanel } from "@/components/forms/verification-requests-panel";
import { DeleteAccountCard } from "@/components/forms/delete-account-card";
import { Trophy, QrCode } from "lucide-react";
import { martialArtName, classDisplayName, martialArtRequiresClass } from "@/lib/martial-arts";
import { divisionDisplayName } from "@/lib/divisions";
import { completenessScore, completenessSteps } from "@/lib/completeness";

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
        },
      },
      user: {
        include: {
          verifications: {
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

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
  const hasFightHistoryEntry = profile.athlete.fightHistory.length > 0;
  const score = completenessScore({
    approved: isApproved,
    hasPortrait,
    injuryAnswered,
    hasFightHistoryEntry,
  });
  const steps = completenessSteps({
    approved: isApproved,
    hasPortrait,
    injuryAnswered,
    hasFightHistoryEntry,
  });

  return (
    <>
      <PageHeader eyebrow="Member" title="My profile">
        Keep your profile up to date. Approved baseline is 50% — add a photo,
        injury info and fight history to reach 100%.
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
              {profile.athlete.portraitUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.athlete.portraitUrl}
                  alt=""
                  className="w-full aspect-[4/5] object-cover rounded-xl mb-3 border border-gold/30"
                />
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
            <section className="bg-surface border border-border rounded-2xl p-6">
              <h2 className="font-display text-2xl text-white tracking-wider mb-5">
                Edit your details
              </h2>
              <FighterProfileForm
                initialName={profile.athlete.name}
                initialNickname={profile.athlete.nickname ?? ""}
                initialCountry={profile.athlete.country ?? ""}
                initialBio={profile.athlete.biography ?? ""}
              />
            </section>

            {isApproved && (
              <>
                <section className="bg-surface border border-border rounded-2xl p-6">
                  <h2 className="font-display text-2xl text-white tracking-wider mb-2">
                    Profile photo
                  </h2>
                  <p className="text-xs text-muted mb-5">
                    Upload a photo from your device or camera. Shows on your
                    passport and public pages.
                  </p>
                  <PortraitForm initialUrl={profile.athlete.portraitUrl ?? ""} />
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
