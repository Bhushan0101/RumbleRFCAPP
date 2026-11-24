import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { deleteNewsPost } from "@/app/actions/news";

export const metadata = { title: "Admin · News" };

export default async function AdminNewsPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/portal");

  const posts = await prisma.newsPost.findMany({
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });

  return (
    <>
      <PageHeader eyebrow="Admin" title="News posts">
        Publish stories for the public /news page.
      </PageHeader>
      <Container className="py-10 space-y-5">
        <div className="flex items-center justify-between">
          <Link href="/portal" className="text-xs text-muted hover:text-white underline">
            ← Portal
          </Link>
          <Link
            href="/portal/admin/news/new"
            className="bg-emerald text-white px-5 py-2.5 font-display font-bold text-xs tracking-wider rounded-full hover:bg-emerald-hi"
          >
            + NEW POST
          </Link>
        </div>

        {posts.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-10 text-center">
            <p className="text-muted">No posts yet.</p>
          </div>
        ) : (
          <ol className="bg-surface border border-border rounded-2xl divide-y divide-border">
            {posts.map((p) => (
              <li key={p.id} className="px-6 py-4 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/portal/admin/news/${p.id}`}
                      className="text-sm text-white hover:underline"
                    >
                      {p.title}
                    </Link>
                    <span
                      className={`text-[10px] font-display tracking-wider px-1.5 py-0.5 rounded ${
                        p.publishedAt ? "bg-emerald text-white" : "bg-surface-3 text-muted border border-border"
                      }`}
                    >
                      {p.publishedAt ? "PUBLISHED" : "DRAFT"}
                    </span>
                  </div>
                  {p.summary && (
                    <p className="text-xs text-muted mt-1">{p.summary}</p>
                  )}
                  <p className="text-[10px] text-muted mt-1">
                    {p.publishedAt
                      ? `Published ${p.publishedAt.toISOString().slice(0, 10)}`
                      : `Draft · created ${p.createdAt.toISOString().slice(0, 10)}`}
                    {" · /news/"}{p.slug}
                  </p>
                </div>
                <form action={deleteNewsPost}>
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    className="text-xs text-red-400 hover:underline"
                  >
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ol>
        )}
      </Container>
    </>
  );
}
