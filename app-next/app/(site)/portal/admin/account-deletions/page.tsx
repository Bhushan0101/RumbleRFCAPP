import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { closeAccountFromRequest } from "@/app/actions/admin";

export const metadata = { title: "Admin · Account deletions" };

export default async function AdminDeletionsPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/portal/sign-in");

  const pending = await prisma.accountDeletionRequest.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
    include: { user: true },
  });
  const processed = await prisma.accountDeletionRequest.findMany({
    where: { status: "processed" },
    orderBy: { processedAt: "desc" },
    take: 10,
  });

  return (
    <>
      <PageHeader eyebrow="Administrator" title="Account deletion requests">
        Review and action member requests to close their W.U.C.O account.
        Closing an account removes sign-in access and withdraws the fighter
        passport.
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
            <EmptyState title="No pending requests." />
          ) : (
            <div className="space-y-3">
              {pending.map((r) => (
                <article
                  key={r.id}
                  className="bg-surface border border-border rounded-xl p-4 md:p-5"
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
                        Requested {new Date(r.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <form action={closeAccountFromRequest}>
                      <input type="hidden" name="request_id" value={r.id} />
                      <button
                        type="submit"
                        className="bg-red-500 text-white px-4 py-2 font-display font-bold text-xs tracking-wider uppercase rounded-full hover:bg-red-600"
                      >
                        Close account
                      </button>
                    </form>
                  </div>
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="text-[10px] font-display tracking-wider text-gold uppercase mb-1">
                      Reason
                    </p>
                    <p className="text-sm text-white whitespace-pre-wrap">
                      {r.reason || <span className="text-muted italic">No reason given.</span>}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-display text-xl tracking-wider text-white mb-3">
            Recently processed
          </h2>
          {processed.length === 0 ? (
            <p className="text-sm text-muted">No processed requests yet.</p>
          ) : (
            <ul className="space-y-2">
              {processed.map((r) => (
                <li
                  key={r.id}
                  className="bg-surface/50 border border-border/50 rounded-lg p-3 text-sm text-muted flex items-center justify-between"
                >
                  <span>
                    Request #{r.id} · user #{r.userId}
                    {r.athleteId != null && <> · athlete #{r.athleteId}</>}
                  </span>
                  <span className="text-xs">
                    {r.processedAt ? new Date(r.processedAt).toLocaleString() : "—"}
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
