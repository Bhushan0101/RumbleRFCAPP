import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";

export default function PrivacyPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Privacy">
        How W.U.C.O Ireland handles your data.
      </PageHeader>
      <Container className="py-10 max-w-3xl">
        <div className="bg-surface border border-border p-6 md:p-8 text-sm text-muted space-y-3">
          <p>This is a design preview — the final privacy policy will be published before launch.</p>
          <p>Data we store: fighter applications (name, email, class, martial art, country, record), gym enquiries, class bookings. We never share your data with third parties.</p>
        </div>
      </Container>
    </>
  );
}
