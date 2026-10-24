import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { reviewFighter } from "@/app/actions/admin";
import { updateFighter } from "@/app/actions/admin-editor";

export const metadata = { title: "Admin · Fighters" };

const CLASS_LABEL: Record<string, string> = {
  J: "J-Class (U18)",
  N: "N-Class (≤5 fights)",
  L: "L-Class (Learning)",
  C: "C-Class (No shin pads)",
  B: "B-Class (Debut pro)",
  A: "A-Class (Seasoned pro)",
};

const CLASS_OPTS = [
  { v: "", label: "No class" },
  { v: "J", label: "J-Class (U18)" },
  { v: "N", label: "N-Class (≤5 fights)" },
  { v: "L", label: "L-Class (Learning)" },
  { v: "C", label: "C-Class (No shin pads)" },
  { v: "B", label: "B-Class (Debut pro)" },
  { v: "A", label: "A-Class (Seasoned pro)" },
];

export default async function AdminFightersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/portal/sign-in");
  const { filter } = await searchParams;

  const where =
    filter && filter !== "all"
      ? { approvalStatus: filter }
      : {};

  const applications = await prisma.fighterProfile.findMany({
    where,
    include: { athlete: { include: { passport: true } }, user: true },
    orderBy: [{ approvalStatus: "asc" }, { athlete: { name: "asc" } }],
  });

  const counts = await prisma.fighterProfile.groupBy({
    by: ["approvalStatus"],
    _count: true,
  });
  const countBy = Object.fromEntries(
    counts.map((c) => [c.approvalStatus, c._count]),
  ) as Record<string, number>;
  const totalAll = Object.values(countBy).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader eyebrow="Administrator" title="Fighter management">
        Review new applications, update records and keep the national registry
        accurate.
      </PageHeader>
      <Container className="py-10">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/portal"
            className="text-xs text-gold font-display tracking-wider"
          >
            ← Back to dashboard
          </Link>
        </div>

        <nav className="flex flex-wrap gap-2 mb-6">
          {[
            ["", "All", totalAll],
            ["pending_approval", "Pending", countBy.pending_approval ?? 0],
            ["approved", "Approved", countBy.approved ?? 0],
            ["rejected", "Declined", countBy.rejected ?? 0],
            ["suspended", "Suspended", countBy.suspended ?? 0],
          ].map(([val, lbl, n]) => {
            const active = (filter ?? "") === String(val);
            const q = val ? `?filter=${val}` : "";
            return (
              <Link
                key={String(lbl)}
                href={`/portal/admin/fighters${q}`}
                className={`px-4 py-2 text-xs font-display tracking-wider border ${
                  active
                    ? "bg-gold text-bg border-gold"
                    : "bg-transparent text-white border-border hover:border-gold"
                }`}
              >
                {lbl} ({n})
              </Link>
            );
          })}
        </nav>

        {applications.length === 0 ? (
          <EmptyState title="No applications in this view." />
        ) : (
          <div className="space-y-5">
            {applications.map((a) => (
              <article
                key={a.athleteId}
                className="bg-surface border border-border p-5"
              >
                <header className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-display text-2xl text-white tracking-wider">
                      {a.athlete.name}
                      {a.athlete.passport?.fighterNo && (
                        <span className="ml-3 text-xs text-gold font-display tracking-wider">
                          {a.athlete.passport.fighterNo}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-muted mt-1">
                      {a.user?.email ?? "Guest application"} ·{" "}
                      {a.athlete.martialArt || "—"} ·{" "}
                      {CLASS_LABEL[a.athlete.classCode ?? ""] ?? "No class"} ·{" "}
                      {a.athlete.division} ·{" "}
                      <span className="text-white font-display">
                        {a.athlete.wins}–{a.athlete.losses}–{a.athlete.draws}
                      </span>
                    </p>
                  </div>
                  <StatusBadge status={a.approvalStatus} />
                </header>

                {a.reviewNote && (
                  <p className="text-xs text-muted border-l-2 border-gold pl-3 mb-4">
                    Admin note: {a.reviewNote}
                  </p>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Decision form */}
                  <form action={reviewFighter} className="space-y-3">
                    <h4 className="font-display text-xs tracking-wider text-gold uppercase">
                      Review decision
                    </h4>
                    <input
                      type="hidden"
                      name="athlete_id"
                      value={a.athleteId}
                    />
                    <select
                      name="decision"
                      defaultValue={
                        a.approvalStatus === "approved" ? "suspended" : "approved"
                      }
                      className="w-full px-3 py-2 bg-bg border border-border text-white"
                    >
                      {a.approvalStatus === "approved" ? (
                        <option value="suspended">Suspend profile</option>
                      ) : (
                        <>
                          <option value="approved">Approve fighter</option>
                          <option value="rejected">Decline application</option>
                        </>
                      )}
                    </select>
                    <textarea
                      name="note"
                      rows={2}
                      maxLength={2000}
                      placeholder="Required for a decline or suspension."
                      className="w-full px-3 py-2 bg-bg border border-border text-white text-sm"
                    />
                    <button
                      type="submit"
                      className="bg-gold text-bg px-4 py-2 font-display text-xs tracking-wider hover:bg-gold-hi"
                    >
                      Save decision →
                    </button>
                  </form>

                  {/* Full edit form */}
                  <details className="bg-bg border border-border">
                    <summary className="cursor-pointer px-4 py-3 font-display text-xs tracking-wider text-gold uppercase">
                      Edit fighter profile & record
                    </summary>
                    <form action={updateFighter} className="p-4 space-y-3">
                      <input
                        type="hidden"
                        name="athlete_id"
                        value={a.athleteId}
                      />
                      <Row>
                        <F label="Full name" name="name" def={a.athlete.name} />
                        <F
                          label="Nickname"
                          name="nickname"
                          def={a.athlete.nickname}
                        />
                      </Row>
                      <Row>
                        <F
                          label="Martial art"
                          name="martial_art"
                          def={a.athlete.martialArt}
                        />
                        <label className="block">
                          <span className="font-display text-[10px] tracking-wider text-gold uppercase">
                            Class
                          </span>
                          <select
                            name="class_code"
                            defaultValue={a.athlete.classCode ?? ""}
                            className="w-full mt-1 px-3 py-2 bg-bg border border-border text-white text-sm"
                          >
                            {CLASS_OPTS.map((c) => (
                              <option key={c.v} value={c.v}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </Row>
                      <Row>
                        <F
                          label="Division"
                          name="division"
                          def={a.athlete.division}
                        />
                        <F
                          label="Country"
                          name="country"
                          def={a.athlete.country}
                        />
                      </Row>
                      <Row>
                        <F
                          label="Wins"
                          name="wins"
                          type="number"
                          def={String(a.athlete.wins)}
                        />
                        <F
                          label="Losses"
                          name="losses"
                          type="number"
                          def={String(a.athlete.losses)}
                        />
                        <F
                          label="Draws"
                          name="draws"
                          type="number"
                          def={String(a.athlete.draws)}
                        />
                      </Row>
                      <label className="block">
                        <span className="font-display text-[10px] tracking-wider text-gold uppercase">
                          Biography
                        </span>
                        <textarea
                          name="biography"
                          rows={3}
                          defaultValue={a.athlete.biography ?? ""}
                          className="w-full mt-1 px-3 py-2 bg-bg border border-border text-white text-sm"
                        />
                      </label>
                      <button
                        type="submit"
                        className="bg-emerald text-white px-4 py-2 font-display text-xs tracking-wider hover:bg-emerald-hi"
                      >
                        Save profile →
                      </button>
                    </form>
                  </details>
                </div>
              </article>
            ))}
          </div>
        )}
      </Container>
    </>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>;
}
function F({
  label,
  name,
  def,
  type = "text",
}: {
  label: string;
  name: string;
  def: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="font-display text-[10px] tracking-wider text-gold uppercase">
        {label}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={def}
        className="w-full mt-1 px-3 py-2 bg-bg border border-border text-white text-sm"
      />
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending_approval: "bg-gold text-bg",
    approved: "bg-emerald text-white",
    rejected: "bg-red-500 text-white",
    suspended: "bg-orange-500 text-white",
  };
  return (
    <span
      className={`inline-block px-2 py-1 text-[10px] tracking-wider font-display ${colors[status] ?? "bg-border text-white"}`}
    >
      {status.replace("_", " ").toUpperCase()}
    </span>
  );
}
