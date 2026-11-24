import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PassportCard } from "@/components/site/passport-card";
import { PassportExportBar } from "@/components/site/passport-export-bar";
import { classDisplayName, martialArtRequiresClass } from "@/lib/martial-arts";
import { divisionDisplayName, genderName } from "@/lib/divisions";

type Params = Promise<{ fighterNo: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { fighterNo } = await params;
  return {
    title: `Fighter Passport · ${fighterNo}`,
    description: "W.U.C.O Ireland verified fighter passport.",
    openGraph: {
      title: `W.U.C.O Fighter Passport · ${fighterNo}`,
      description: "Verified fighter record.",
    },
  };
}

// Map the three DB approval states to the spec's public status labels.
function statusLabel(approval: string | undefined): string {
  switch (approval) {
    case "approved":         return "Active";
    case "pending_approval": return "Pending";
    case "rejected":         return "Suspended";
    case "suspended":        return "Suspended";
    default:                 return "Inactive";
  }
}

export default async function PassportPage({ params }: { params: Params }) {
  const { fighterNo } = await params;
  const no = fighterNo.toUpperCase();
  if (!/^[A-Z]{3}-[0-9]{3,8}$/.test(no)) notFound();

  const row = await prisma.fighterPassport.findUnique({
    where: { fighterNo: no },
    include: {
      athlete: {
        include: {
          profile: { include: { gym: true } },
          disciplines: true,
        },
      },
    },
  });
  if (!row) notFound();
  const approval = row.athlete.profile?.approvalStatus;
  // Only approved + suspended fighters have a public-visible passport.
  if (approval !== "approved" && approval !== "suspended") notFound();

  // Sort disciplines so primary shows first.
  const disciplines = [...row.athlete.disciplines].sort(
    (a, b) => b.isPrimary - a.isPrimary,
  );

  const data = {
    fighterNo: row.fighterNo,
    name: row.athlete.name,
    division:
      divisionDisplayName(row.athlete.gender, row.athlete.division) ||
      row.athlete.division,
    gender: genderName(row.athlete.gender),
    classCode: martialArtRequiresClass(row.athlete.martialArt)
      ? classDisplayName(row.athlete.martialArt, row.athlete.classCode) || row.athlete.classCode
      : null,
    martialArt: row.athlete.martialArt,
    record: `${row.athlete.wins}-${row.athlete.losses}-${row.athlete.draws}`,
    status: statusLabel(approval),
    nationality: row.athlete.country || "Ireland",
    club: row.athlete.profile?.gym?.name ?? "Independent",
    portraitUrl: row.athlete.portraitUrl ?? null,
    disciplines: disciplines.map((d) => ({
      martialArt: d.martialArt,
      classCode: d.classCode,
      wins: d.wins,
      losses: d.losses,
      draws: d.draws,
      isPrimary: d.isPrimary,
    })),
  };

  return (
    <section className="min-h-screen bg-bg py-10 lg:py-16 passport-page">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex justify-between items-center mb-6 text-[11px] tracking-wider font-display no-print">
          <Link href="/" className="text-gold border-b border-gold pb-1">
            ← W.U.C.O WEBSITE
          </Link>
          <span className="text-gold">DIGITAL FIGHTER PASSPORT</span>
        </div>
        <div className="no-print">
          <PassportExportBar fighterNo={row.fighterNo} name={row.athlete.name} />
        </div>
        <PassportCard data={data} />
      </div>
      <style>{`
        @media print {
          body { background: #06261D !important; }
          .no-print { display: none !important; }
          .passport-page { padding: 0 !important; min-height: 0 !important; }
        }
      `}</style>
    </section>
  );
}
