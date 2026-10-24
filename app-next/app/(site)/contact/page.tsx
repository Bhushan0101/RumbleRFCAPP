import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";

export default function ContactPage() {
  return (
    <>
      <PageHeader eyebrow="Get in touch" title="Contact">
        General, media and sponsorship enquiries.
      </PageHeader>
      <Container className="py-10 max-w-2xl">
        <div className="bg-surface border border-border p-6 md:p-8 space-y-4 text-sm text-muted">
          <p>Email: <a className="text-gold underline" href="mailto:ops@wuco.ie">ops@wuco.ie</a></p>
          <p>For club onboarding, use the <a className="text-gold underline" href="/clubs/join">club enquiry form</a>.</p>
          <p>For promoter applications, email <a className="text-gold underline" href="mailto:ops@wuco.ie">ops@wuco.ie</a>.</p>
        </div>
      </Container>
    </>
  );
}
