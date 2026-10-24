import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";

export const metadata = { title: "Become a promoter" };

export default function PromoterJoinPage() {
  return (
    <>
      <PageHeader eyebrow="Work with WUCO" title="Become a promoter">
        Apply to run sanctioned W.U.C.O events. Our team will review and get in
        touch with next steps.
      </PageHeader>
      <Container className="py-10">
        <div className="max-w-2xl bg-surface border border-border p-6 md:p-8">
          <p className="text-sm text-muted">
            Promoter applications open soon. In the meantime please email{" "}
            <a href="mailto:ops@wuco.ie" className="text-gold underline">
              ops@wuco.ie
            </a>{" "}
            with your event history, affiliations and licensing details.
          </p>
        </div>
      </Container>
    </>
  );
}
