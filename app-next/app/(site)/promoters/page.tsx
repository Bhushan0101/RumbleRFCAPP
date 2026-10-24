import Link from "next/link";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";

export const metadata = { title: "Promoters" };

export default function PromotersPage() {
  return (
    <>
      <PageHeader eyebrow="National structure" title="Promoters">
        W.U.C.O Ireland works with sanctioned promoters to run national events
        and championships. If you're a promoter looking to work with us, apply
        below.
      </PageHeader>
      <Container className="py-10">
        <div className="grid gap-6 md:grid-cols-2 max-w-4xl">
          <div className="bg-surface border border-border p-6">
            <h2 className="font-display text-xl text-white tracking-wider">
              Become a promoter
            </h2>
            <p className="text-sm text-muted mt-3">
              Deliver sanctioned W.U.C.O events, access the national rankings
              feed and build the Irish combat sports calendar.
            </p>
            <Link
              href="/promoters/join"
              className="inline-block mt-5 bg-gold text-bg px-5 py-2.5 font-display font-bold text-xs tracking-wider hover:bg-gold-hi"
            >
              PROMOTER APPLICATION →
            </Link>
          </div>
          <div className="bg-surface border border-border p-6">
            <h2 className="font-display text-xl text-white tracking-wider">
              Promoter directory
            </h2>
            <p className="text-sm text-muted mt-3">
              Approved W.U.C.O promoters are listed here once onboarded.
            </p>
          </div>
        </div>
      </Container>
    </>
  );
}
