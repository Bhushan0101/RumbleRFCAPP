import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const [fighters, gyms, events, passports] = await Promise.all([
    prisma.athlete.findMany({
      where: { profile: { approvalStatus: "approved" } },
      select: { id: true },
    }),
    prisma.gym.findMany({
      where: { status: "active" },
      select: { slug: true },
    }),
    prisma.event.findMany({ select: { id: true } }),
    prisma.fighterPassport.findMany({ select: { fighterNo: true } }),
  ]).catch(() => [[], [], [], []] as const);

  const staticRoutes = [
    "", "/rankings", "/fighters", "/clubs", "/clubs/join",
    "/events", "/promoters", "/promoters/join", "/about",
    "/register", "/portal/sign-in", "/contact", "/privacy", "/terms",
  ];

  return [
    ...staticRoutes.map((p) => ({
      url: `${site}${p}`,
      changeFrequency: "weekly" as const,
      priority: p === "" ? 1 : 0.7,
    })),
    ...fighters.map((f) => ({ url: `${site}/fighters/${f.id}`, priority: 0.6 })),
    ...gyms.filter((g) => g.slug).map((g) => ({ url: `${site}/clubs/${g.slug}`, priority: 0.6 })),
    ...events.map((e) => ({ url: `${site}/events/${e.id}`, priority: 0.6 })),
    ...passports.map((p) => ({ url: `${site}/passport/${p.fighterNo}`, priority: 0.5 })),
  ];
}
