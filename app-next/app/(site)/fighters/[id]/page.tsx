import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";

const CLASS_LABEL: Record<string, string> = {
  J: "J-Class (U18)",
  N: "N-Class (≤5 fights)",
  L: "L-Class (Learning)",
  C: "C-Class (No shin pads)",
  B: "B-Class (Debut pro)",
  A: "A-Class (Seasoned pro)",
};

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const f = await prisma.athlete.findUnique({ where: { id: Number(id) } });
  if (!f) return { title: "Fighter not found" };
  return { title: `${f.name} · Fighter profile` };
}

export default async function FighterPage({ params }: { params: Params }) {
  const { id } = await params;
  const f = await prisma.athlete.findUnique({
    where: { id: Number(id) },
    include: { profile: true, passport: true, rankings: true },
  });
  if (!f || f.profile?.approvalStatus !== "approved") notFound();

  return (
    <>
      <PageHeader eyebrow="Fighter profile" title={f.name}>
        {f.martialArt && <>Discipline: <strong className="text-white">{f.martialArt}</strong>. </>}
        {f.classCode && <>Class: <strong className="text-white">{CLASS_LABEL[f.classCode] ?? f.classCode}</strong>.</>}
      </PageHeader>
      <Container className="py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <aside className="bg-surface border border-border p-6">
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-[10px] tracking-wider text-gold uppercase">Fighter No</dt>
                <dd className="font-display text-xl text-white tracking-wider mt-1">
                  {f.passport?.fighterNo ?? "Not issued"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] tracking-wider text-gold uppercase">Nationality</dt>
                <dd className="text-white mt-1">{f.country || "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] tracking-wider text-gold uppercase">Division</dt>
                <dd className="text-white mt-1">{f.division}</dd>
              </div>
              <div>
                <dt className="text-[10px] tracking-wider text-gold uppercase">Record (W–L–D)</dt>
                <dd className="font-display text-xl text-white tracking-wider mt-1">
                  {f.wins}–{f.losses}–{f.draws}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] tracking-wider text-gold uppercase">Status</dt>
                <dd className="text-emerald mt-1 font-display tracking-wider">
                  ACTIVE
                </dd>
              </div>
              {f.passport?.fighterNo && (
                <Link
                  href={`/passport/${f.passport.fighterNo}`}
                  className="inline-flex w-full justify-center items-center gap-2 bg-gold text-bg py-3 font-display font-bold text-xs tracking-wider uppercase hover:bg-gold-hi"
                >
                  View digital passport →
                </Link>
              )}
            </dl>
          </aside>
          <section className="space-y-6">
            <div className="bg-surface border border-border p-6">
              <h2 className="font-display text-xl text-white tracking-wider mb-3">
                Biography
              </h2>
              <p className="text-sm text-muted leading-relaxed">
                {f.biography ||
                  `${f.name} is a ${CLASS_LABEL[f.classCode ?? ""] ?? "WUCO"} fighter competing in ${f.division}. More details will be added by their coach or the fighter directly from the member portal.`}
              </p>
            </div>
            {f.rankings.length > 0 && (
              <div className="bg-surface border border-border p-6">
                <h2 className="font-display text-xl text-white tracking-wider mb-3">
                  Rankings
                </h2>
                <ul className="space-y-2 text-sm">
                  {f.rankings.map((r) => (
                    <li key={r.id} className="flex justify-between text-white">
                      <span>{r.division}</span>
                      <span className="font-display text-gold">#{r.position}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </Container>
    </>
  );
}
