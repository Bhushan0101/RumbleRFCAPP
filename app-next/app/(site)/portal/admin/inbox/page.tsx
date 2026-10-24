import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Admin · Notifications" };

const CATEGORY_LABEL: Record<string, string> = {
  fighter_signup: "Fighter signup",
  fighter_approved: "Fighter approved",
  fighter_rejected: "Fighter declined",
  gym_enquiry: "Gym enquiry",
  gym_onboarding: "Onboarding link sent",
  gym_submitted: "Gym onboarding submitted",
  gym_approved: "Gym approved",
  gym_join_request: "Gym join request",
  class_booking: "Class booking",
};

export default async function AdminInboxPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/portal/sign-in");

  const mail = await prisma.outboundMail.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <>
      <PageHeader eyebrow="Administrator" title="Notifications inbox">
        Every outbound email is logged here (and in <code>logs/outbound_mail.log</code>) until SMTP is wired up.
      </PageHeader>
      <Container className="py-10">
        <Link
          href="/portal"
          className="text-xs text-gold font-display tracking-wider mb-4 inline-block"
        >
          ← Back to portal
        </Link>
        {mail.length === 0 ? (
          <EmptyState title="Inbox is empty." />
        ) : (
          <div className="bg-surface border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left bg-surface-3 text-xs tracking-wider font-display text-gold">
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">To</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Category</th>
                </tr>
              </thead>
              <tbody>
                {mail.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">
                      {m.createdAt.toISOString().slice(0, 19).replace("T", " ")}
                    </td>
                    <td className="px-4 py-3 text-white">{m.toAddress}</td>
                    <td className="px-4 py-3 text-white">
                      <div>{m.subject}</div>
                      <details className="mt-1">
                        <summary className="text-xs text-muted cursor-pointer">
                          Body
                        </summary>
                        <pre className="text-xs text-muted mt-2 whitespace-pre-wrap font-sans">
                          {m.body}
                        </pre>
                      </details>
                    </td>
                    <td className="px-4 py-3 text-xs text-gold">
                      {CATEGORY_LABEL[m.category] ?? m.category}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Container>
    </>
  );
}
