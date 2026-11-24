import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { markAllNotificationsRead } from "@/app/actions/notifications";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/portal/sign-in");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader eyebrow="Alerts" title="Notifications">
        {unread > 0
          ? `${unread} unread ${unread === 1 ? "update" : "updates"}.`
          : "You're all caught up."}
      </PageHeader>
      <Container className="py-10 space-y-4">
        <div className="flex items-center justify-between">
          <Link
            href="/portal"
            className="text-xs text-muted hover:text-white underline"
          >
            ← Back to portal
          </Link>
          {unread > 0 && (
            <form action={markAllNotificationsRead}>
              <button
                type="submit"
                className="text-xs text-gold hover:underline"
              >
                Mark all as read
              </button>
            </form>
          )}
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
                      <p
                        className={`text-sm ${
                          n.readAt ? "text-muted" : "text-white font-medium"
                        }`}
                      >
                        {!n.readAt && (
                          <span className="inline-block w-2 h-2 rounded-full bg-gold mr-2 align-middle" />
                        )}
                        {n.title}
                      </p>
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
