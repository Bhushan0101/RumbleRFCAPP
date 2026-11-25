import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ReviewForm } from "@/components/forms/review-form";
import { DeleteFighterButton } from "@/components/forms/delete-fighter-button";
import { AdminMartialArtClassFields } from "@/components/forms/admin-martial-art-class-fields";
import { updateFighter } from "@/app/actions/admin-editor";
import { martialArtName, classDisplayName, martialArtRequiresClass } from "@/lib/martial-arts";
import { divisionDisplayName, genderName } from "@/lib/divisions";

export const metadata = { title: "Admin · Fighters" };

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
    include: {
      athlete: {
        include: {
          passport: true,
          disciplines: true,
          audits: { orderBy: { createdAt: "asc" } },
        },
      },
      user: true,
      gym: true,
      coach: true,
    },
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
                      {genderName(a.athlete.gender) || "—"} ·{" "}
                      {martialArtName(a.athlete.martialArt) || "—"} ·{" "}
                      {martialArtRequiresClass(a.athlete.martialArt)
                        ? (classDisplayName(a.athlete.martialArt, a.athlete.classCode) || "No class")
                        : "—"} ·{" "}
                      {divisionDisplayName(a.athlete.gender, a.athlete.division) || "—"} ·{" "}
                      <span className="text-white font-display">
                        {a.athlete.wins}–{a.athlete.losses}–{a.athlete.draws}
                      </span>
                    </p>
                  </div>
                  <StatusBadge status={a.approvalStatus} />
                </header>

                {a.reviewNote && !/^Gym:\s.*(·\s*Coach:|$)/.test(a.reviewNote) && (
                  <p className="text-xs text-muted border-l-2 border-gold pl-3 mb-4">
                    Admin note: {a.reviewNote}
                  </p>
                )}

                <ApplicationDetails app={a} />

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Decision form */}
                  <div>
                    <h4 className="font-display text-xs tracking-wider text-gold uppercase mb-3">
                      Review decision
                    </h4>
                    <ReviewForm
                      athleteId={a.athleteId}
                      currentStatus={a.approvalStatus}
                    />
                    <div className="mt-4 pt-4 border-t border-border">
                      <DeleteFighterButton
                        athleteId={a.athleteId}
                        fighterName={a.athlete.name}
                      />
                    </div>
                  </div>

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
                        <AdminMartialArtClassFields
                          initialGender={a.athlete.gender ?? ""}
                          initialDivision={a.athlete.division ?? ""}
                          initialDisciplines={a.athlete.disciplines.map((d) => ({
                            martialArt: d.martialArt,
                            classCode: d.classCode,
                            wins: d.wins,
                            losses: d.losses,
                            draws: d.draws,
                            isPrimary: d.isPrimary,
                          }))}
                        />
                      </Row>
                      <Row>
                        <F
                          label="Country"
                          name="country"
                          def={a.athlete.country}
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

type AppWithExtras = {
  athlete: {
    disciplines: {
      martialArt: string;
      classCode: string | null;
      wins: number;
      losses: number;
      draws: number;
      isPrimary: number;
    }[];
    audits: { action: string; note: string; createdAt: Date }[];
    country: string | null;
    dateOfBirth: string;
    gender: string | null;
  };
  gym: { name: string } | null;
  coach: { name: string } | null;
  reviewNote: string;
};

function ApplicationDetails({ app }: { app: AppWithExtras }) {
  const submittedAudit = app.athlete.audits.find((a) => a.action === "submitted");
  // Pull the record_note the applicant entered at signup — the submission audit note
  // carries "Declared records → … <trailing record_note>".
  const recordNote = (() => {
    if (!submittedAudit) return "";
    // Everything after the last period before the final free-text block isn't reliable;
    // the register action appends the note with a trailing space, so just surface
    // whatever comes after the first "→ " and the "; " joined record list.
    const n = submittedAudit.note;
    const idx = n.indexOf(". ");
    if (idx === -1) return "";
    const tail = n.slice(idx + 2).trim();
    return tail;
  })();

  // Gym and coach names captured at registration live in `FighterProfile.reviewNote`
  // as "Gym: <name> · Coach: <name> · Record note: …". The relational FighterProfile.gym
  // and .coach only populate later if an admin links the fighter to a Gym/Coach record.
  // Parse the typed names out of reviewNote for display.
  const typedGym = (() => {
    const m = app.reviewNote.match(/Gym:\s*([^·]+?)(?:\s*·|$)/);
    return m ? m[1].trim() : "";
  })();
  const typedCoach = (() => {
    const m = app.reviewNote.match(/Coach:\s*([^·]+?)(?:\s*·|$)/);
    return m ? m[1].trim() : "";
  })();
  const gymDisplay = app.gym?.name ?? typedGym;
  const coachDisplay = app.coach?.name ?? typedCoach;
  // Only keep genuine free-text applicant notes — strip the gym/coach lines the
  // submission audit auto-prepends so we don't double up.
  const cleanApplicantNotes = recordNote
    .replace(/Gym:\s*[^.]+\.\s*/g, "")
    .replace(/Coach:\s*[^.]+\.\s*/g, "")
    .trim();

  return (
    <div className="bg-bg/60 border border-border rounded-lg p-4 mb-4 space-y-3">
      <h4 className="font-display text-xs tracking-wider text-gold uppercase">
        Application details
      </h4>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-muted">Gym</dt>
          <dd className="text-white font-display">
            {gymDisplay || <span className="text-red-300">Not supplied</span>}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-muted">Coach</dt>
          <dd className="text-white font-display">
            {coachDisplay || <span className="text-red-300">Not supplied</span>}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-muted">Country</dt>
          <dd className="text-white">{app.athlete.country || "—"}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-muted">Date of birth</dt>
          <dd className="text-white">{app.athlete.dateOfBirth || "—"}</dd>
        </div>
      </dl>

      {app.athlete.disciplines.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted mb-1">
            Disciplines & declared record
          </p>
          <ul className="text-xs space-y-0.5">
            {[...app.athlete.disciplines]
              .sort((a, b) => b.isPrimary - a.isPrimary)
              .map((d) => (
                <li key={d.martialArt} className="flex flex-wrap items-center gap-2 text-white">
                  <span className="font-display tracking-wider uppercase">
                    {martialArtName(d.martialArt)}
                  </span>
                  {d.classCode && martialArtRequiresClass(d.martialArt) && (
                    <span className="text-gold">
                      · {classDisplayName(d.martialArt, d.classCode)}
                    </span>
                  )}
                  {d.isPrimary === 1 && (
                    <span className="bg-gold text-bg text-[9px] px-1.5 py-0.5 rounded-full">
                      PRIMARY
                    </span>
                  )}
                  <span className="ml-auto font-display">
                    {d.wins}-{d.losses}-{d.draws}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {cleanApplicantNotes && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted mb-1">
            Applicant notes
          </p>
          <p className="text-xs text-white/85 whitespace-pre-wrap">{cleanApplicantNotes}</p>
        </div>
      )}
    </div>
  );
}
