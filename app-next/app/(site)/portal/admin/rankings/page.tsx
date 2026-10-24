import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { setRanking } from "@/app/actions/admin-editor";

export const metadata = { title: "Admin · Rankings" };

export default async function AdminRankingsPage() {
  const session = await auth();
  if (
    session?.user?.role !== "admin" &&
    session?.user?.role !== "ranking_admin"
  ) {
    redirect("/portal/sign-in");
  }

  const [rankings, fighters] = await Promise.all([
    prisma.ranking.findMany({
      include: { athlete: { include: { passport: true } } },
      orderBy: [{ division: "asc" }, { position: "asc" }],
    }),
    prisma.athlete.findMany({
      where: { profile: { approvalStatus: "approved" } },
      orderBy: { name: "asc" },
    }),
  ]);

  const divisions = Array.from(
    new Set([...rankings.map((r) => r.division), "Featherweight", "Lightweight"]),
  );

  return (
    <>
      <PageHeader eyebrow="Administrator" title="Rankings">
        Set the official position per division. Set a position to 0 to remove
        the fighter from that ranking.
      </PageHeader>
      <Container className="py-10 space-y-8">
        <Link
          href="/portal"
          className="text-xs text-gold font-display tracking-wider"
        >
          ← Back to dashboard
        </Link>

        {divisions.map((division) => {
          const list = rankings.filter((r) => r.division === division);
          return (
            <section
              key={division}
              className="bg-surface border border-border p-5"
            >
              <h2 className="font-display text-xl text-white tracking-wider mb-4">
                {division}
              </h2>
              {list.length === 0 ? (
                <p className="text-sm text-muted mb-4">
                  No ranking set for this division yet.
                </p>
              ) : (
                <ol className="divide-y divide-border mb-5">
                  {list.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between py-3"
                    >
                      <span className="flex items-center gap-3">
                        <span className="font-display text-xl text-gold w-6">
                          {r.position}
                        </span>
                        <Link
                          href={`/fighters/${r.athlete.id}`}
                          className="text-white hover:text-gold"
                        >
                          {r.athlete.name}
                          <span className="block text-xs text-muted">
                            {r.athlete.passport?.fighterNo} ·{" "}
                            {r.athlete.wins}–{r.athlete.losses}–{r.athlete.draws}
                          </span>
                        </Link>
                      </span>
                      <form
                        action={setRanking}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="hidden"
                          name="athlete_id"
                          value={r.athlete.id}
                        />
                        <input type="hidden" name="division" value={division} />
                        <input
                          name="position"
                          type="number"
                          min={0}
                          max={999}
                          defaultValue={r.position}
                          className="w-16 px-2 py-1 bg-bg border border-border text-white text-sm text-center"
                        />
                        <button className="bg-gold text-bg px-3 py-1 text-xs font-display tracking-wider hover:bg-gold-hi">
                          SAVE
                        </button>
                      </form>
                    </li>
                  ))}
                </ol>
              )}
              <details className="bg-bg border border-border p-4">
                <summary className="cursor-pointer text-xs font-display tracking-wider text-gold uppercase">
                  + Add fighter to ranking
                </summary>
                <form action={setRanking} className="mt-3 flex items-end gap-3">
                  <input type="hidden" name="division" value={division} />
                  <label className="flex-1">
                    <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
                      Fighter
                    </span>
                    <select
                      name="athlete_id"
                      required
                      className="w-full px-3 py-2 bg-bg border border-border text-white text-sm"
                    >
                      {fighters
                        .filter((f) => f.division === division)
                        .filter((f) => !list.find((r) => r.athlete.id === f.id))
                        .map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name} ({f.wins}–{f.losses}–{f.draws})
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
                      Position
                    </span>
                    <input
                      name="position"
                      type="number"
                      min={1}
                      max={999}
                      defaultValue={list.length + 1}
                      className="w-20 px-2 py-2 bg-bg border border-border text-white text-sm text-center"
                    />
                  </label>
                  <button className="bg-emerald text-white px-4 py-2 text-xs font-display tracking-wider hover:bg-emerald-hi">
                    ADD →
                  </button>
                </form>
              </details>
            </section>
          );
        })}
      </Container>
    </>
  );
}
