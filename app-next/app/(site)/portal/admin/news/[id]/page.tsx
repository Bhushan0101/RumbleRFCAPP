import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { NewsPostForm } from "@/components/forms/news-post-form";

export const metadata = { title: "Admin · Edit post" };

type Params = Promise<{ id: string }>;

export default async function EditNewsPostPage({ params }: { params: Params }) {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/portal");

  const { id } = await params;
  const post = await prisma.newsPost.findUnique({ where: { id: Number(id) } });
  if (!post) notFound();

  return (
    <>
      <PageHeader eyebrow="Admin" title="Edit news post">
        {post.title}
      </PageHeader>
      <Container className="py-10">
        <Link
          href="/portal/admin/news"
          className="text-xs text-muted hover:text-white underline mb-6 inline-block"
        >
          ← All posts
        </Link>
        <NewsPostForm
          mode="edit"
          initial={{
            id: post.id,
            title: post.title,
            summary: post.summary,
            body: post.body,
            coverUrl: post.coverUrl,
            publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
          }}
        />
      </Container>
    </>
  );
}
