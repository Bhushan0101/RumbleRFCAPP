import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Ranking admin lands here to manage positions — mirrors the admin tool
// but is scoped to ranking_admin + admin roles.
export default async function RankingAdminRankings() {
  const session = await auth();
  if (!session?.user) redirect("/portal/sign-in");
  if (session.user.role !== "admin" && session.user.role !== "ranking_admin") {
    redirect("/portal");
  }
  redirect("/portal/admin/rankings");
}
