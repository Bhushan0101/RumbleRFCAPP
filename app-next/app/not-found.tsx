import Link from "next/link";
import { Container } from "@/components/ui/container";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 flex items-center">
        <Container className="py-24 text-center">
          <p className="font-display text-sm tracking-[0.4em] text-gold uppercase mb-4">
            404
          </p>
          <h1 className="font-display font-black text-5xl md:text-7xl text-white tracking-wider">
            Not found.
          </h1>
          <p className="text-muted mt-4 max-w-md mx-auto">
            The page you were looking for doesn't exist, or the record isn't
            public yet.
          </p>
          <Link
            href="/"
            className="inline-block mt-6 bg-gold text-bg px-6 py-3 font-display font-bold text-xs tracking-wider hover:bg-gold-hi"
          >
            Return home →
          </Link>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
