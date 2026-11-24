import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SiteHeaderClient } from "./site-header-client";

export async function SiteHeader() {
  const session = await auth();
  const user = session?.user
    ? {
        name: session.user.name ?? "Member",
        email: session.user.email ?? null,
        role: session.user.role,
      }
    : null;

  const unreadNotifications =
    session?.user?.id != null
      ? await prisma.notification.count({
          where: { userId: session.user.id, readAt: null },
        })
      : 0;

  return <SiteHeaderClient user={user} unreadNotifications={unreadNotifications} />;
}
