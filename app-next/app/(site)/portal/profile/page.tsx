import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { FighterProfileForm } from "@/components/forms/fighter-profile-form";
import { RequestCorrectionButton } from "@/components/forms/request-correction-button";
import { Trophy, QrCode } from "lucide-react";

export const metadata = { title: "My profile" };

const CLASS_LABEL: Record<string, string> = {
  J: "J-Class (U18)",
  N: "N-Class (≤5 fights)",
  L: "L-Class (Learning)",
  C: "C-Class (No shin pads)",
  B: "B-Class (Debut pro)",
  A: "A-Class (Seasoned pro)",
};

export default async function MyProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/portal/sign-in");

  const profile = await prisma.fighterProfile.findFirst({
    where: { userId: session.user.id },
    include: {
      athlete: {
        include: { passport: true },
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

  return (
    <>
      <PageHeader eyebrow="Member" title="My profile">
        Edit your bio and personal details. Your record, class and division are
        maintained by W.U.C.O administrators.
      </PageHeader>
      <Container className="py-10">
        <Link
          href="/portal"
          className="text-xs text-gold font-display tracking-wider mb-6 inline-block"
        >
          ← Back to dashboard
        </Link>

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
              <p className="font-display text-xl text-white tracking-wider">
                {profile.athlete.name}
              </p>
              {profile.athlete.nickname && (
                <p className="text-xs text-muted mt-1">
                  “{profile.athlete.nickname}”
                </p>
              )}
              <p className="text-xs text-muted mt-2">
                {profile.athlete.martialArt || "—"} ·{" "}
                {CLASS_LABEL[profile.athlete.classCode ?? ""] ?? "No class"}
              </p>
              <p className="text-xs text-muted">
                {profile.athlete.division} · {profile.athlete.country}
              </p>
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
