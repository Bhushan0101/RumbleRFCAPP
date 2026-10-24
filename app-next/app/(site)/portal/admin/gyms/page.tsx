import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { inviteGym, rejectEnquiry, approveGymEnquiry } from "@/app/actions/admin";

export const metadata = { title: "Admin · Gyms" };

const STATUS_LABEL: Record<string, string> = {
  new: "New enquiry",
  invited: "Onboarding link sent",
  onboarding: "Form in progress",
  submitted: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
};

export default async function AdminGymsPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/portal/sign-in");

  const enquiries = await prisma.gymEnquiry.findMany({
    orderBy: { createdAt: "desc" },
  });

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
                <div className="flex flex-wrap gap-2 pt-2">
                  {e.status === "new" && (
                    <>
                      <form action={inviteGym}>
                        <input type="hidden" name="enquiry_id" value={e.id} />
                        <button className="bg-gold text-bg px-4 py-2 font-display text-xs tracking-wider hover:bg-gold-hi">
                          Send onboarding link
                        </button>
                      </form>
                      <form action={rejectEnquiry}>
                        <input type="hidden" name="enquiry_id" value={e.id} />
                        <input
                          type="hidden"
                          name="note"
                          value="Not aligned with WUCO affiliation criteria."
                        />
                        <button className="border border-gold text-white px-4 py-2 font-display text-xs tracking-wider hover:bg-gold hover:text-bg">
                          Reject
                        </button>
                      </form>
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
                  {e.status === "submitted" && (
                    <form action={approveGymEnquiry}>
                      <input type="hidden" name="enquiry_id" value={e.id} />
                      <button className="bg-gold text-bg px-4 py-2 font-display text-xs tracking-wider hover:bg-gold-hi">
                        Approve &amp; create coach account
                      </button>
                    </form>
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
