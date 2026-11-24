import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  const post = await prisma.newsPost.findUnique({ where: { slug } });
  if (!post || !post.publishedAt) return { title: "Not found" };
  return {
    title: post.title,
    description: post.summary || undefined,
    openGraph: { title: post.title, description: post.summary || undefined },
  };
}

export default async function NewsPostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = await prisma.newsPost.findUnique({
    where: { slug },
    include: { author: true },
  });
  if (!post || !post.publishedAt) notFound();

  return (
    <>
      <PageHeader eyebrow="News" title={post.title}>
        {post.publishedAt.toISOString().slice(0, 10)}
        {post.author?.name && ` · ${post.author.name}`}
      </PageHeader>
      <Container className="py-10 max-w-3xl">
        <Link
          href="/news"
          className="text-xs text-gold font-display tracking-wider mb-6 inline-block"
        >
          ← All news
        </Link>
        {post.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverUrl}
            alt=""
            className="w-full aspect-[16/9] object-cover rounded-2xl mb-6 border border-border"
          />
        )}
        {post.summary && (
          <p className="text-lg text-muted border-l-2 border-gold pl-4 mb-6">
            {post.summary}
          </p>
        )}
        <article className="prose prose-invert text-white whitespace-pre-wrap leading-relaxed">
          {post.body}
        </article>
      </Container>
    </>
  );
}
