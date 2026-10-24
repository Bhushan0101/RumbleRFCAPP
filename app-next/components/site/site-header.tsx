import { auth } from "@/lib/auth";
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
  return <SiteHeaderClient user={user} />;
}
