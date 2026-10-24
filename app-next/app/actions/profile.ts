"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const profileSchema = z.object({
  name: z.string().min(1).max(120),
  nickname: z.string().max(120).optional().default(""),
  country: z.string().max(60).optional().default(""),
  biography: z.string().max(4000).optional().default(""),
});

export type ProfileState = { ok: boolean; message: string };

export async function updateOwnProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user) return { ok: false, message: "Please sign in." };
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: "Please correct the form." };
  }
  const profile = await prisma.fighterProfile.findFirst({
    where: { userId: session.user.id },
    select: { athleteId: true },
  });
  if (!profile) return { ok: false, message: "No fighter profile linked." };

  const d = parsed.data;
  await prisma.$transaction([
    prisma.athlete.update({
      where: { id: profile.athleteId },
      data: {
        name: d.name,
        nickname: d.nickname,
        country: d.country,
        biography: d.biography,
      },
    }),
    prisma.portalUser.update({
      where: { id: session.user.id! },
      data: { name: d.name },
    }),
    prisma.applicationAudit.create({
      data: {
        athleteId: profile.athleteId,
        actorId: session.user.id!,
        action: "profile_updated",
        note: "by fighter (self)",
      },
    }),
  ]);
  revalidatePath("/portal/profile");
  revalidatePath("/portal");
  revalidatePath(`/fighters/${profile.athleteId}`);
  return { ok: true, message: "Profile saved." };
}
