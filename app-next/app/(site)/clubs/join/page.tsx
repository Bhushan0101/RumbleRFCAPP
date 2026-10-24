import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { ClubJoinForm } from "@/components/forms/club-join-form";

export const metadata = {
  title: "Join WUCO as a Club",
  description: "Register your gym with W.U.C.O Ireland.",
};

export default function ClubJoinPage() {
  return (
    <>
      <PageHeader eyebrow="Grow with us" title="Join WUCO as a Club">
        Tell us about your club and a W.U.C.O admin will reach out with the full
        onboarding form. Nothing is published yet — this is a short enquiry to
        get started.
      </PageHeader>
      <Container className="py-10">
        <div className="max-w-2xl">
          <div className="bg-surface border border-border p-6 md:p-8">
            <ClubJoinForm />
          </div>
        </div>
      </Container>
    </>
  );
}
