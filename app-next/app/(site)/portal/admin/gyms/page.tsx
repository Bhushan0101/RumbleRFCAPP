import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  inviteGym,
  rejectEnquiry,
  approveGymEnquiry,
  requestGymInfo,
  closeGym,
} from "@/app/actions/admin";

export const metadata = { title: "Admin · Gyms" };

const STATUS_LABEL: Record<string, string> = {
  new: "New enquiry",
  invited: "Onboarding link sent",
  onboarding: "Form in progress",
  info_requested: "Awaiting club answer",
  submitted: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
};

export default async function AdminGymsPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/portal/sign-in");

  const [enquiries, submittedGyms, activeGyms] = await Promise.all([
    prisma.gymEnquiry.findMany({
      orderBy: { createdAt: "desc" },
      include: { followups: { orderBy: { askedAt: "asc" } } },
    }),
    prisma.gym.findMany({
      where: { status: { in: ["pending_review", "active"] } },
    }),
    prisma.gym.findMany({
      where: { status: "active" },
      include: {
        closures: {
          where: { status: "pending" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: { select: { fighters: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  // Match a submitted onboarding back to its originating enquiry via the
  // contact email captured at onboarding time.
  const gymByEmail = new Map<string, (typeof submittedGyms)[number]>();
  for (const g of submittedGyms) {
    if (g.contactEmail) gymByEmail.set(g.contactEmail.toLowerCase(), g);
  }

  return (
    <>
      <PageHeader eyebrow="Administrator" title="Gym enquiries">
        Review new gym enquiries, send onboarding links, and approve
        submissions to create a coach account.
      </PageHeader>
      <Container className="py-10">
        <div className="flex justify-between items-center mb-6">
          <Link
            href="/portal"
            className="text-xs text-gold font-display tracking-wider"
          >
            ← Back to portal
          </Link>
          <Link
            href="/clubs/join"
            target="_blank"
            className="text-xs text-gold border-b border-gold pb-1 font-display tracking-wider"
          >
            Public enquiry page ↗
          </Link>
        </div>

        {/* --- Active clubs management (withdraw / force close) ---- */}
        {activeGyms.length > 0 && (
          <section className="bg-surface border border-border rounded-xl p-5 mb-6">
            <h2 className="font-display text-lg text-white tracking-wider mb-3">
              Active clubs ({activeGyms.length})
            </h2>
            <ul className="divide-y divide-border/60">
              {activeGyms.map((g) => {
                const pending = g.closures[0];
                return (
                  <li key={g.id} className="py-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-display text-sm text-white tracking-wider">
                        {g.name}
                      </span>
                      <span className="text-xs text-muted">
                        {g._count.fighters} fighter{g._count.fighters === 1 ? "" : "s"}
                      </span>
                      {pending && (
                        <span className="text-[10px] font-display tracking-wider px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-200">
                          WITHDRAWAL REQUESTED
                        </span>
                      )}
                      {g.slug && (
                        <Link
                          href={`/clubs/${g.slug}`}
                          target="_blank"
                          className="ml-auto text-[11px] text-gold hover:underline"
                        >
                          public page ↗
                        </Link>
                      )}
                    </div>
                    {pending && (
                      <p className="text-xs text-white/80 border-l-2 border-orange-500 pl-3 whitespace-pre-wrap">
                        {pending.reason || "(no reason given)"}
                      </p>
                    )}
                    <CloseGymForm gymId={g.id} closureRequestId={pending?.id ?? null} />
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {enquiries.length === 0 ? (
          <EmptyState
            title="No gym enquiries yet."
            description="Share /clubs/join with prospective clubs to collect enquiries."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {enquiries.map((e) => (
              <div
                key={e.id}
                className="bg-surface border border-border p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-xl text-white tracking-wider">
                      {e.gymName}
                    </h3>
                    <p className="text-xs text-muted mt-1">
                      {e.contactName} · {e.contactEmail}
                      {e.phone && <> · {e.phone}</>}
                      {e.city && <> · {e.city}</>}
                    </p>
                  </div>
                  <span className="inline-block px-2 py-1 text-[10px] tracking-wider font-display bg-border text-white">
                    {STATUS_LABEL[e.status] ?? e.status}
                  </span>
                </div>
                {e.message && (
                  <p className="text-sm text-muted">“{e.message}”</p>
                )}
                {e.reviewNote && (
                  <p className="text-xs text-muted">
                    Admin note: {e.reviewNote}
                  </p>
                )}
                {gymByEmail.get(e.contactEmail.toLowerCase()) && (
                  <SubmittedDetails
                    gym={gymByEmail.get(e.contactEmail.toLowerCase())!}
                  />
                )}

                {e.followups.length > 0 && (
                  <FollowupThread
                    followups={e.followups.map((f) => ({
                      id: f.id,
                      question: f.question,
                      answer: f.answer,
                      askedAt: f.askedAt.toISOString(),
                      answeredAt: f.answeredAt?.toISOString() ?? null,
                    }))}
                  />
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  {e.status === "new" && (
                    <>
                      <form action={inviteGym}>
                        <input type="hidden" name="enquiry_id" value={e.id} />
                        <button className="bg-gold text-bg px-4 py-2 font-display text-xs tracking-wider hover:bg-gold-hi">
                          Send onboarding link
                        </button>
                      </form>
                      <RejectForm enquiryId={e.id} />
                    </>
                  )}
                  {(e.status === "invited" || e.status === "onboarding") && (
                    <form action={inviteGym}>
                      <input type="hidden" name="enquiry_id" value={e.id} />
                      <button className="border border-gold text-white px-4 py-2 font-display text-xs tracking-wider hover:bg-gold hover:text-bg">
                        Resend link
                      </button>
                    </form>
                  )}
                  {(e.status === "submitted" || e.status === "info_requested") && (
                    <>
                      {e.followups.every((f) => f.answeredAt) ? (
                        <form action={approveGymEnquiry}>
                          <input type="hidden" name="enquiry_id" value={e.id} />
                          <button className="bg-emerald text-white px-4 py-2 font-display text-xs tracking-wider hover:bg-emerald-hi rounded">
                            Approve &amp; create coach account
                          </button>
                        </form>
                      ) : (
                        <span className="inline-flex items-center px-3 py-2 text-[11px] text-orange-200 font-display tracking-wider bg-orange-500/10 border border-orange-500/40 rounded">
                          Waiting on answers to open follow-up questions
                        </span>
                      )}
                      <RequestInfoForm enquiryId={e.id} />
                      <RejectForm enquiryId={e.id} />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Container>
    </>
  );
}

type GymLike = {
  name: string;
  logoUrl: string | null;
  addressLine1: string;
  eircode: string;
  city: string;
  county: string;
  yearEstablished: number | null;
  phone: string;
  website: string;
  socialLinks: string;
  membersTotal: number | null;
  membersUnder18: number | null;
  disciplines: string;
  governingBody: string;
  about: string;
  coachName: string;
  coachRank: string;
  coachYearsTraining: number | null;
  coachStyle: string;
  coachLastGradeYear: number | null;
  coachPhone: string;
  coachEmail: string;
  coachQualifications: string;
  coachYearsCoaching: number | null;
  coachCertifications: string;
  coachFirstAidExpiry: string;
  coachSafeguarding: string;
  coachGardaVetting: string;
};

function SubmittedDetails({ gym }: { gym: GymLike }) {
  return (
    <details className="bg-bg border border-border rounded-lg">
      <summary className="cursor-pointer px-3 py-2 font-display text-[11px] tracking-wider text-gold uppercase">
        View submitted club details
      </summary>
      <div className="p-4 space-y-4 text-xs">
        {gym.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={gym.logoUrl}
            alt="Club logo"
            className="w-24 h-24 object-contain border border-border rounded bg-black/40 p-1"
          />
        )}
        <section>
          <h5 className="font-display text-xs tracking-wider text-gold uppercase mb-2">
            Club info
          </h5>
          <DL>
            <DT label="Address">{gym.addressLine1 || "—"}</DT>
            <DT label="Eircode">{gym.eircode || "—"}</DT>
            <DT label="City / County">{[gym.city, gym.county].filter(Boolean).join(" · ") || "—"}</DT>
            <DT label="Established">{gym.yearEstablished ?? "—"}</DT>
            <DT label="Phone">{gym.phone || "—"}</DT>
            <DT label="Website">{gym.website || "—"}</DT>
            <DT label="Social links">
              {gym.socialLinks ? (
                <span className="whitespace-pre-wrap">{gym.socialLinks}</span>
              ) : (
                "—"
              )}
            </DT>
            <DT label="Members">
              {gym.membersTotal ?? "—"} total ({gym.membersUnder18 ?? "—"} u18)
            </DT>
            <DT label="Disciplines">{gym.disciplines || "—"}</DT>
            <DT label="Governing body">{gym.governingBody || "—"}</DT>
            <DT label="About">
              {gym.about ? <span className="whitespace-pre-wrap">{gym.about}</span> : "—"}
            </DT>
          </DL>
        </section>
        <section>
          <h5 className="font-display text-xs tracking-wider text-gold uppercase mb-2">
            Head coach
          </h5>
          <DL>
            <DT label="Name">{gym.coachName || "—"}</DT>
            <DT label="Rank / belt">{gym.coachRank || "—"}</DT>
            <DT label="Years training">{gym.coachYearsTraining ?? "—"}</DT>
            <DT label="Style">{gym.coachStyle || "—"}</DT>
            <DT label="Year of last grade">{gym.coachLastGradeYear ?? "—"}</DT>
            <DT label="Contact">{[gym.coachPhone, gym.coachEmail].filter(Boolean).join(" · ") || "—"}</DT>
            <DT label="Qualifications">
              {gym.coachQualifications ? <span className="whitespace-pre-wrap">{gym.coachQualifications}</span> : "—"}
            </DT>
            <DT label="Years coaching">{gym.coachYearsCoaching ?? "—"}</DT>
            <DT label="Certifications">
              {gym.coachCertifications ? <span className="whitespace-pre-wrap">{gym.coachCertifications}</span> : "—"}
            </DT>
            <DT label="First aid expires">{gym.coachFirstAidExpiry || "—"}</DT>
            <DT label="Safeguarding">{gym.coachSafeguarding || "—"}</DT>
            <DT label="Garda vetting">{gym.coachGardaVetting || "—"}</DT>
          </DL>
        </section>
      </div>
    </details>
  );
}

function DL({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">{children}</dl>;
}
function DT({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted">{label}</dt>
      <dd className="text-white">{children}</dd>
    </div>
  );
}

// -------- Follow-up thread --------------------------------------------------

type FollowupRow = {
  id: number;
  question: string;
  answer: string;
  askedAt: string;
  answeredAt: string | null;
};

function FollowupThread({ followups }: { followups: FollowupRow[] }) {
  const open = followups.filter((f) => !f.answeredAt);
  return (
    <details className="bg-bg border border-border rounded-lg" open={open.length > 0}>
      <summary className="cursor-pointer px-3 py-2 font-display text-[11px] tracking-wider text-gold uppercase">
        Follow-up Q&amp;A ({followups.length})
        {open.length > 0 && (
          <span className="ml-2 inline-block bg-orange-500/30 text-orange-200 px-2 py-0.5 rounded-full text-[10px]">
            {open.length} awaiting answer
          </span>
        )}
      </summary>
      <ul className="p-4 space-y-4 text-xs">
        {followups.map((f) => (
          <li key={f.id} className="border-l-2 border-gold/40 pl-3">
            <p className="text-gold font-display tracking-wider text-[11px] uppercase mb-1">
              Q · {f.askedAt.slice(0, 10)}
            </p>
            <p className="text-white/90 whitespace-pre-wrap mb-2">{f.question}</p>
            {f.answeredAt ? (
              <>
                <p className="text-muted font-display tracking-wider text-[11px] uppercase mb-1">
                  A · {f.answeredAt.slice(0, 10)}
                </p>
                <p className="text-white/80 whitespace-pre-wrap">{f.answer}</p>
              </>
            ) : (
              <p className="text-orange-200 italic text-[11px]">Awaiting answer…</p>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

function RequestInfoForm({ enquiryId }: { enquiryId: number }) {
  return (
    <details className="w-full">
      <summary className="cursor-pointer inline-block border border-gold text-white px-4 py-2 font-display text-xs tracking-wider hover:bg-gold hover:text-bg rounded">
        Ask for more info
      </summary>
      <form action={requestGymInfo} className="mt-3 space-y-2 w-full max-w-xl">
        <input type="hidden" name="enquiry_id" value={enquiryId} />
        <label className="block">
          <span className="font-display text-[10px] tracking-wider text-gold uppercase block mb-1">
            Question to the club
          </span>
          <textarea
            name="question"
            required
            rows={3}
            maxLength={4000}
            placeholder="E.g. Please upload a photo of your current public liability insurance policy."
            className="w-full px-3 py-2.5 bg-bg border border-border text-white text-sm rounded focus:border-gold outline-none"
          />
        </label>
        <button className="bg-gold text-bg px-4 py-2 font-display text-xs tracking-wider hover:bg-gold-hi rounded">
          Send question →
        </button>
      </form>
    </details>
  );
}

function RejectForm({ enquiryId }: { enquiryId: number }) {
  return (
    <details>
      <summary className="cursor-pointer inline-block border border-red-500 text-red-200 px-4 py-2 font-display text-xs tracking-wider hover:bg-red-500 hover:text-white rounded">
        Reject
      </summary>
      <form action={rejectEnquiry} className="mt-3 space-y-2 w-full max-w-xl">
        <input type="hidden" name="enquiry_id" value={enquiryId} />
        <label className="block">
          <span className="font-display text-[10px] tracking-wider text-red-200 uppercase block mb-1">
            Rejection reason (emailed to the club)
          </span>
          <textarea
            name="note"
            rows={2}
            maxLength={1000}
            defaultValue="Not aligned with WUCO affiliation criteria."
            className="w-full px-3 py-2.5 bg-bg border border-border text-white text-sm rounded"
          />
        </label>
        <button className="border border-red-500 text-red-200 px-4 py-2 font-display text-xs tracking-wider hover:bg-red-500 hover:text-white rounded">
          Confirm rejection
        </button>
      </form>
    </details>
  );
}

function CloseGymForm({
  gymId,
  closureRequestId,
}: {
  gymId: number;
  closureRequestId: number | null;
}) {
  return (
    <details>
      <summary className="cursor-pointer inline-block border border-red-500 text-red-200 px-3 py-1.5 font-display text-xs tracking-wider hover:bg-red-500 hover:text-white rounded">
        {closureRequestId ? "Process withdrawal / close club" : "Close this club"}
      </summary>
      <form action={closeGym} className="mt-3 space-y-2 max-w-xl">
        <input type="hidden" name="gym_id" value={gymId} />
        {closureRequestId && (
          <input type="hidden" name="closure_request_id" value={closureRequestId} />
        )}
        <p className="text-xs text-muted">
          This unpublishes the club, unlinks every affiliated fighter, and
          emails the club owner. Cannot be undone from the UI.
        </p>
        <label className="flex items-start gap-2 text-xs text-red-200 pt-1">
          <input
            type="checkbox"
            name="delete_owner_login"
            value="1"
            defaultChecked
            className="accent-red-500 mt-0.5"
          />
          <span>
            Also remove the club owner&apos;s login so the email becomes
            reusable (recommended — unchecked only if the user has other W.U.C.O
            responsibilities).
          </span>
        </label>
        <label className="block">
          <span className="font-display text-[10px] tracking-wider text-red-200 uppercase block mb-1">
            Note to the club (optional)
          </span>
          <textarea
            name="note"
            rows={2}
            maxLength={1000}
            placeholder="E.g. Processed per your withdrawal request on 2026-11-26."
            className="w-full px-3 py-2.5 bg-bg border border-border text-white text-sm rounded"
          />
        </label>
        <button className="bg-red-500 text-white px-4 py-2 font-display text-xs tracking-wider hover:bg-red-600 rounded">
          Confirm — close club
        </button>
      </form>
    </details>
  );
}
