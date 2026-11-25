import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { setRanking } from "@/app/actions/admin-editor";
import {
  GENDERS,
  divisionDisplayName,
  divisionsFor,
} from "@/lib/divisions";
import { MARTIAL_ARTS, martialArtName } from "@/lib/martial-arts";

export const metadata = { title: "Admin · Rankings" };

type SearchParams = {
  sport?: string;
  gender?: string;
  division?: string;
  vacated?: string;
  focus?: string;
};

export default async function AdminRankingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (
    session?.user?.role !== "admin" &&
    session?.user?.role !== "ranking_admin"
  ) {
    redirect("/portal/sign-in");
  }
  const sp = await searchParams;
  const sport = typeof sp.sport === "string" ? sp.sport : "";
  const gender = typeof sp.gender === "string" ? sp.gender : "";
  const division = typeof sp.division === "string" ? sp.division : "";
  const focusAthleteId =
    typeof sp.focus === "string" && /^\d+$/.test(sp.focus) ? Number(sp.focus) : 0;
  const vacatedNames = typeof sp.vacated === "string" && sp.vacated.length > 0
    ? sp.vacated.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  // --- Awaiting-ranking roster ----------------------------------------------
  // Approved fighters whose primary (division, martialArt) has NO Ranking row
  // for them. We cross-check via a second query because Prisma on SQLite can't
  // express "no ranking matching my division" in one where-clause.
  const approved = await prisma.athlete.findMany({
    where: { profile: { approvalStatus: "approved" } },
    select: {
      id: true,
      name: true,
      gender: true,
      martialArt: true,
      division: true,
      rankings: { select: { division: true } },
    },
    orderBy: { name: "asc" },
  });
  const awaiting = approved
    .filter((a) => a.division && a.martialArt)
    .filter((a) => !a.rankings.some((r) => r.division === a.division))
    .map((a) => ({
      id: a.id,
      name: a.name,
      gender: a.gender ?? "",
      sport: a.martialArt ?? "",
      division: a.division ?? "",
    }));

  // Division list follows the chosen gender/sport. MMA ignores gender.
  const availableDivisions = divisionsFor(gender, sport);

  // Only query when the admin has picked a concrete division — avoids loading
  // every athlete up front.
  const rankings = division
    ? await prisma.ranking.findMany({
        where: {
          division,
          // Filter to fighters whose primary martial art matches the chosen sport.
          athlete: sport ? { martialArt: sport } : {},
        },
        include: { athlete: { include: { passport: true } } },
        orderBy: { position: "asc" },
      })
    : [];

  // Candidates to add to this division — same filters applied.
  const candidates = division
    ? await prisma.athlete.findMany({
        where: {
          profile: { approvalStatus: "approved" },
          division,
          ...(sport ? { martialArt: sport } : {}),
        },
        orderBy: { name: "asc" },
      })
    : [];
  const unranked = candidates.filter((c) => !rankings.find((r) => r.athleteId === c.id));

  // Preserve the active filter when posting the form so we come back to the
  // same view after save.
  const returnPath =
    `/portal/admin/rankings?sport=${encodeURIComponent(sport)}` +
    `&gender=${encodeURIComponent(gender)}&division=${encodeURIComponent(division)}`;

  return (
    <>
      <PageHeader eyebrow="Administrator" title="Rankings">
        Pick a sport, gender and category to administer that division&apos;s ranking.
        Set a position to 0 to remove a fighter. Moving someone into an
        occupied position will vacate the previous holder — you&apos;ll see a
        notice if that happens.
      </PageHeader>
      <Container className="py-10 space-y-6">
        <Link
          href="/portal"
          className="text-xs text-gold font-display tracking-wider"
        >
          ← Back to dashboard
        </Link>

        {vacatedNames.length > 0 && (
          <div
            role="status"
            className="border border-orange-400/60 bg-orange-400/10 text-orange-200 rounded-lg p-4"
          >
            <p className="font-display text-xs tracking-wider uppercase text-orange-200 mb-1">
              Rankings vacated
            </p>
            <p className="text-sm">
              Your save pushed {vacatedNames.length === 1 ? "someone" : "the following fighters"} out of their previous position:{" "}
              <strong>{vacatedNames.join(", ")}</strong>. They are now unranked in
              this division — reassign them or leave them out as needed.
            </p>
          </div>
        )}

        {/* Fighters awaiting a ranking assignment */}
        <section className="bg-surface border border-gold/40 rounded-xl p-5">
          <header className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="font-display text-lg text-white tracking-wider">
              Awaiting ranking
            </h2>
            <span className="text-xs text-muted">
              {awaiting.length === 0
                ? "All approved fighters have a ranking"
                : `${awaiting.length} fighter${awaiting.length === 1 ? "" : "s"} unassigned`}
            </span>
          </header>
          {awaiting.length === 0 ? (
            <p className="text-xs text-muted">
              Everyone who&apos;s been approved has a ranking in their primary division.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {awaiting.map((a) => {
                const target =
                  `/portal/admin/rankings?sport=${encodeURIComponent(a.sport)}` +
                  `&gender=${encodeURIComponent(a.gender)}` +
                  `&division=${encodeURIComponent(a.division)}` +
                  `&focus=${a.id}#focus-${a.id}`;
                return (
                  <li key={a.id}>
                    <Link
                      href={target}
                      className="flex flex-col gap-1 border border-border hover:border-gold bg-bg/60 rounded-lg px-3 py-2.5 transition-colors"
                    >
                      <span className="font-display text-sm text-white tracking-wider">
                        {a.name}
                      </span>
                      <span className="text-[11px] text-muted">
                        {martialArtName(a.sport)} ·{" "}
                        {divisionDisplayName(a.gender, a.division)}
                      </span>
                      <span className="text-[10px] font-display tracking-wider text-gold uppercase mt-0.5">
                        Allot ranking →
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Filter selector (plain GET form so state lives in the URL) */}
        <form
          method="get"
          className="bg-surface border border-border rounded-xl p-5 grid gap-4 md:grid-cols-[1fr_1fr_2fr_auto]"
        >
          <label className="block">
            <span className="font-display text-[10px] tracking-wider text-gold uppercase mb-1 block">
              Sport
            </span>
            <select
              name="sport"
              defaultValue={sport}
              className="w-full px-3 py-2.5 bg-bg border border-border text-white text-sm rounded-lg"
            >
              <option value="">— pick sport —</option>
              {MARTIAL_ARTS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="font-display text-[10px] tracking-wider text-gold uppercase mb-1 block">
              Gender
            </span>
            <select
              name="gender"
              defaultValue={gender}
              disabled={sport === "mma"}
              className="w-full px-3 py-2.5 bg-bg border border-border text-white text-sm rounded-lg disabled:opacity-50"
            >
              <option value="">
                {sport === "mma" ? "n/a for MMA" : "— pick gender —"}
              </option>
              {GENDERS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="font-display text-[10px] tracking-wider text-gold uppercase mb-1 block">
              Category
            </span>
            <select
              name="division"
              defaultValue={division}
              disabled={availableDivisions.length === 0}
              className="w-full px-3 py-2.5 bg-bg border border-border text-white text-sm rounded-lg disabled:opacity-50"
            >
              <option value="">
                {availableDivisions.length === 0
                  ? "— pick sport + gender first —"
                  : "— pick category —"}
              </option>
              {availableDivisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="bg-gold text-bg px-5 py-2.5 font-display font-bold text-xs tracking-wider uppercase rounded-full hover:bg-gold-hi w-full md:w-auto"
            >
              Load
            </button>
          </div>
        </form>

        {!division ? (
          <EmptyState title="Pick a sport, gender and category to see rankings." />
        ) : (
          <section className="bg-surface border border-border p-5 rounded-xl">
            <header className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
              <h2 className="font-display text-xl text-white tracking-wider">
                {martialArtName(sport)} · {divisionDisplayName(gender || null, division)}
              </h2>
              <p className="text-xs text-muted">
                {rankings.length} ranked ·{" "}
                {unranked.length} unranked eligible
              </p>
            </header>

            {rankings.length === 0 ? (
              <p className="text-sm text-muted mb-5">
                No ranking set for this category yet.
              </p>
            ) : (
              <ol className="divide-y divide-border mb-5">
                {rankings.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-3">
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
                          {r.athlete.passport?.fighterNo ?? "—"} ·{" "}
                          {r.athlete.wins}–{r.athlete.losses}–{r.athlete.draws}
                        </span>
                      </Link>
                    </span>
                    <form action={setRanking} className="flex items-center gap-2">
                      <input type="hidden" name="athlete_id" value={r.athlete.id} />
                      <input type="hidden" name="division" value={division} />
                      <input type="hidden" name="return_to" value={returnPath} />
                      <input
                        name="position"
                        type="number"
                        min={0}
                        max={999}
                        defaultValue={r.position}
                        className="w-16 px-2 py-1 bg-bg border border-border text-white text-sm text-center rounded"
                      />
                      <button className="bg-gold text-bg px-3 py-1 text-xs font-display tracking-wider hover:bg-gold-hi rounded">
                        SAVE
                      </button>
                    </form>
                  </li>
                ))}
              </ol>
            )}

            {unranked.length > 0 && (
              <details
                open={
                  focusAthleteId > 0 &&
                  unranked.some((f) => f.id === focusAthleteId)
                }
                id={focusAthleteId ? `focus-${focusAthleteId}` : undefined}
                className={`bg-bg border rounded-lg p-4 ${
                  focusAthleteId > 0 &&
                  unranked.some((f) => f.id === focusAthleteId)
                    ? "border-gold ring-1 ring-gold/40"
                    : "border-border"
                }`}
              >
                <summary className="cursor-pointer text-xs font-display tracking-wider text-gold uppercase">
                  + Add fighter to ranking
                  {focusAthleteId > 0 &&
                    unranked.some((f) => f.id === focusAthleteId) && (
                      <span className="ml-2 inline-block text-[10px] bg-gold text-bg px-2 py-0.5 rounded-full align-middle">
                        AWAITING RANKING
                      </span>
                    )}
                </summary>
                <form action={setRanking} className="mt-3 flex flex-wrap items-end gap-3">
                  <input type="hidden" name="division" value={division} />
                  <input type="hidden" name="return_to" value={returnPath} />
                  <label className="flex-1 min-w-[200px]">
                    <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
                      Fighter
                    </span>
                    <select
                      name="athlete_id"
                      required
                      defaultValue={
                        focusAthleteId > 0 &&
                        unranked.some((f) => f.id === focusAthleteId)
                          ? String(focusAthleteId)
                          : undefined
                      }
                      className="w-full px-3 py-2 bg-bg border border-border text-white text-sm rounded"
                    >
                      {unranked.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.wins}–{f.losses}–{f.draws})
                          {f.id === focusAthleteId ? "  ← awaiting" : ""}
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
                      defaultValue={rankings.length + 1}
                      className="w-20 px-2 py-2 bg-bg border border-border text-white text-sm text-center rounded"
                    />
                  </label>
                  <button className="bg-emerald text-white px-4 py-2 text-xs font-display tracking-wider hover:bg-emerald-hi rounded">
                    ADD →
                  </button>
                </form>
              </details>
            )}
          </section>
        )}
      </Container>
    </>
  );
}
