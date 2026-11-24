import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  verifyVerificationRequest,
  rejectVerificationRequest,
} from "@/app/actions/admin";

export const metadata = { title: "Admin · Verification requests" };

export default async function AdminVerificationsPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/portal/sign-in");

  const pending = await prisma.verificationRequest.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
    include: { user: true },
  });
  const recent = await prisma.verificationRequest.findMany({
    where: { status: { in: ["verified", "rejected"] } },
    orderBy: { verifiedAt: "desc" },
    take: 15,
    include: { user: true },
  });

  return (
    <>
      <PageHeader eyebrow="Administrator" title="Verification requests">
        Review fighter-submitted verification requests. Once verified, the entry
        is locked for the fighter and they can submit a new one.
      </PageHeader>
      <Container className="py-10">
        <div className="mb-6">
          <Link
            href="/portal"
            className="text-xs text-gold font-display tracking-wider"
          >
            ← Back to dashboard
          </Link>
        </div>

        <section className="mb-10">
          <h2 className="font-display text-xl tracking-wider text-white mb-3">
            Pending ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <EmptyState title="No pending verification requests." />
          ) : (
            <div className="space-y-4">
              {pending.map((r) => (
                <article
                  key={r.id}
                  className="bg-surface border border-gold/40 rounded-xl p-4 md:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-base text-white tracking-wider">
                        {r.user.name}{" "}
                        <span className="text-xs text-muted font-mono">
                          &lt;{r.user.email}&gt;
                        </span>
                      </p>
                      <p className="text-xs text-muted mt-1">
                        Role: {r.user.role}
                        {r.athleteId != null && <> · Athlete #{r.athleteId}</>}
                        {" · "}
                        Submitted {new Date(r.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-border pt-3 bg-black/20 rounded-lg p-3">
                    <p className="text-sm text-white whitespace-pre-wrap">
                      {r.body}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-col md:flex-row md:items-end gap-3">
                    <form
                      action={verifyVerificationRequest}
                      className="flex-1 flex flex-col md:flex-row md:items-end gap-2"
                    >
                      <input type="hidden" name="request_id" value={r.id} />
                      <label className="flex-1 block">
                        <span className="block font-display text-[10px] tracking-wider text-gold uppercase mb-1">
                          Admin note (optional)
                        </span>
                        <input
                          type="text"
                          name="admin_note"
                          maxLength={2000}
                          placeholder="Shared with the fighter in the confirmation email."
                          className="w-full px-3 py-2 bg-bg border border-border text-white text-sm focus:border-gold outline-none rounded-lg"
                        />
                      </label>
                      <button
                        type="submit"
                        className="bg-emerald text-white px-4 py-2 font-display font-bold text-xs tracking-wider uppercase rounded-full hover:bg-emerald-hi whitespace-nowrap"
                      >
                        Verify
                      </button>
                    </form>
                    <form action={rejectVerificationRequest}>
                      <input type="hidden" name="request_id" value={r.id} />
                      <input
                        type="hidden"
                        name="admin_note"
                        value="Please update and resubmit."
                      />
                      <button
                        type="submit"
                        className="border border-red-500 text-red-400 px-4 py-2 font-display font-bold text-xs tracking-wider uppercase rounded-full hover:bg-red-500 hover:text-white"
                      >
                        Reject
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-display text-xl tracking-wider text-white mb-3">
            Recently actioned
          </h2>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">Nothing actioned yet.</p>
          ) : (
            <ul className="space-y-2">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="bg-surface/50 border border-border/50 rounded-lg p-3 text-sm text-muted flex items-center justify-between gap-3"
                >
                  <span className="truncate">
                    #{r.id} · {r.user.name} ·{" "}
                    <span
                      className={
                        r.status === "verified"
                          ? "text-emerald"
                          : "text-red-400"
                      }
                    >
                      {r.status}
                    </span>
                  </span>
                  <span className="text-xs whitespace-nowrap">
                    {r.verifiedAt
                      ? new Date(r.verifiedAt).toLocaleString()
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Container>
    </>
  );
}
