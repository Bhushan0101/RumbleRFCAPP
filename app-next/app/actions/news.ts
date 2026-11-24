"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("Forbidden");
  return session.user;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "post";
}

const newsSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().max(400).optional().default(""),
  body: z.string().min(1).max(50000),
  cover_url: z.string().max(1000).optional().default(""),
  publish: z.enum(["draft", "published"]).default("draft"),
});

export type NewsState = { ok: boolean; message: string };

export async function createNewsPost(
  _prev: NewsState,
  formData: FormData,
): Promise<NewsState> {
  let adminUser;
  try {
    adminUser = await requireAdmin();
  } catch {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = newsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: "Please add a title and body." };
  }
  const d = parsed.data;
  let slug = slugify(d.title);
  for (let i = 2; await prisma.newsPost.findUnique({ where: { slug } }); i++) {
    slug = `${slugify(d.title)}-${i}`;
  }
  await prisma.newsPost.create({
    data: {
      slug,
      title: d.title,
      summary: d.summary,
      body: d.body,
      coverUrl: d.cover_url,
      publishedAt: d.publish === "published" ? new Date() : null,
      authorId: adminUser.id ? Number(adminUser.id) : null,
    },
  });
  revalidatePath("/portal/admin/news");
  revalidatePath("/news");
  return { ok: true, message: d.publish === "published" ? "Published." : "Saved as draft." };
}

export async function updateNewsPost(
  _prev: NewsState,
  formData: FormData,
): Promise<NewsState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, message: "Admin access required." };
  }
  const id = Number(formData.get("id"));
  if (!id) return { ok: false, message: "Missing post id." };
  const parsed = newsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Please add a title and body." };
  const d = parsed.data;
  const existing = await prisma.newsPost.findUnique({ where: { id } });
  if (!existing) return { ok: false, message: "Post not found." };
  await prisma.newsPost.update({
    where: { id },
    data: {
      title: d.title,
      summary: d.summary,
      body: d.body,
      coverUrl: d.cover_url,
      publishedAt:
        d.publish === "published"
          ? (existing.publishedAt ?? new Date())
          : null,
    },
  });
  revalidatePath("/portal/admin/news");
  revalidatePath("/news");
  revalidatePath(`/news/${existing.slug}`);
  return { ok: true, message: "Updated." };
}

export async function deleteNewsPost(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!id) return;
  const row = await prisma.newsPost.findUnique({ where: { id } });
  await prisma.newsPost.delete({ where: { id } });
  revalidatePath("/portal/admin/news");
  revalidatePath("/news");
  if (row) revalidatePath(`/news/${row.slug}`);
}
