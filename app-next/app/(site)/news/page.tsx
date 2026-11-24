import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";

export const metadata = { title: "News" };

export default async function NewsListPage() {
  const posts = await prisma.newsPost.findMany({
    where: { publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  return (
    <>
      <PageHeader eyebrow="Latest" title="News">
        Updates from W.U.C.O Ireland.
      </PageHeader>
      <Container className="py-10">
        {posts.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-10 text-center">
            <p className="text-muted">No news yet. Check back soon.</p>
          </div>
        ) : (
          <ol className="grid gap-5 md:grid-cols-2">
            {posts.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/news/${p.slug}`}
                  className="block bg-surface border border-border hover:border-gold rounded-2xl overflow-hidden transition-colors"
                >
                  {p.coverUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.coverUrl}
                      alt=""
                      className="w-full aspect-[16/9] object-cover"
                    />
                  )}
                  <div className="p-5">
                    <p className="text-[10px] font-display tracking-wider text-gold uppercase mb-2">
                      {p.publishedAt?.toISOString().slice(0, 10)}
                    </p>
                    <h2 className="font-display text-xl text-white tracking-wide">
                      {p.title}
                    </h2>
                    {p.summary && (
                      <p className="text-sm text-muted mt-2">{p.summary}</p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </Container>
    </>
  );
}
