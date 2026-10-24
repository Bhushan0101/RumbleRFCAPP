import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PassportCard } from "@/components/site/passport-card";

type Params = Promise<{ fighterNo: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { fighterNo } = await params;
  return {
    title: `Fighter Passport · ${fighterNo}`,
    description: "W.U.C.O Ireland verified fighter passport.",
    openGraph: {
      title: `W.U.C.O Fighter Passport · ${fighterNo}`,
      description: "Verified fighter record and rankings.",
    },
  };
}

export default async function PassportPage({ params }: { params: Params }) {
  const { fighterNo } = await params;
  const no = fighterNo.toUpperCase();
  if (!/^[A-Z]{3}-[0-9]{3,8}$/.test(no)) notFound();

  const row = await prisma.fighterPassport.findUnique({
    where: { fighterNo: no },
    include: {
      athlete: {
        include: { profile: { include: { gym: true } } },
      },
    },
  });
  if (!row) notFound();
  const status = row.athlete.profile?.approvalStatus;
  if (status !== "approved" && status !== "suspended") notFound();

  const data = {
    fighterNo: row.fighterNo,
    name: row.athlete.name,
    division: row.athlete.division,
    classCode: row.athlete.classCode,
    martialArt: row.athlete.martialArt,
    record: `${row.athlete.wins}-${row.athlete.losses}-${row.athlete.draws}`,
    status: status === "approved" ? "Active" : "Suspended",
    nationality: row.athlete.country || "Ireland",
    club: row.athlete.profile?.gym?.name ?? "Independent",
    portraitUrl: row.athlete.portraitUrl ?? null,
  };

  return (
    <section className="min-h-screen bg-bg py-10 lg:py-16">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex justify-between items-center mb-6 text-[11px] tracking-wider font-display">
          <Link href="/" className="text-gold border-b border-gold pb-1">
            ← W.U.C.O WEBSITE
          </Link>
          <span className="text-gold">DIGITAL FIGHTER PASSPORT</span>
        </div>
        <PassportCard data={data} />
      </div>
    </section>
  );
}
