import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { NewsPostForm } from "@/components/forms/news-post-form";

export const metadata = { title: "Admin · New post" };

export default async function NewNewsPostPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/portal");

  return (
    <>
      <PageHeader eyebrow="Admin" title="New news post">
        Draft or publish a new story.
      </PageHeader>
      <Container className="py-10">
        <Link
          href="/portal/admin/news"
          className="text-xs text-muted hover:text-white underline mb-6 inline-block"
        >
          ← All posts
        </Link>
        <NewsPostForm mode="create" />
      </Container>
    </>
  );
}
