import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";

export const metadata = { title: "Notifications" };
// Visiting this page marks notifications read, so it must run on every hit.
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/portal/sign-in");

  // Mark every unread notification read the moment the page loads. The
  // header's bell count re-queries on every request (SiteHeader is dynamic),
  // so the badge drops to 0 on the next navigation without us having to
  // revalidate anything from inside this render.
  await prisma.notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <>
      <PageHeader eyebrow="Alerts" title="Notifications">
        You&apos;re all caught up.
      </PageHeader>
      <Container className="py-10 space-y-4">
        <div className="flex items-center justify-between">
          <Link
            href="/portal"
            className="text-xs text-muted hover:text-white underline"
          >
            ← Back to portal
          </Link>
        </div>

        {notifications.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-10 text-center">
            <p className="text-muted">No notifications yet.</p>
          </div>
        ) : (
          <ol className="bg-surface border border-border rounded-2xl divide-y divide-border">
            {notifications.map((n) => {
              const inner = (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-muted">{n.title}</p>
                      {n.body && (
                        <p className="text-xs text-muted mt-1">{n.body}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted whitespace-nowrap">
                      {n.createdAt.toISOString().slice(0, 10)}
                    </span>
                  </div>
                </>
              );
              return (
                <li key={n.id}>
                  {n.link ? (
                    <Link
                      href={n.link}
                      className="block px-6 py-4 hover:bg-surface-3 transition-colors"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="px-6 py-4">{inner}</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </Container>
    </>
  );
}
