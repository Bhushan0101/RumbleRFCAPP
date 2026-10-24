import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";

export default function TermsPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Terms">
        Terms of use.
      </PageHeader>
      <Container className="py-10 max-w-3xl">
        <div className="bg-surface border border-border p-6 md:p-8 text-sm text-muted space-y-3">
          <p>This is a design preview — the final terms of use will be published before launch.</p>
        </div>
      </Container>
    </>
  );
}
