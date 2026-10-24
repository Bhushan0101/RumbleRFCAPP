import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { FighterRegisterForm } from "@/components/forms/fighter-register-form";

export const metadata = {
  title: "Register as a fighter",
  description: "Join W.U.C.O Ireland and start your official fight record.",
};

export default function RegisterPage() {
  return (
    <>
      <PageHeader
        eyebrow="Your next chapter"
        title="Register as a fighter"
      >
        Create your fighter application. An administrator reviews it before your
        profile is published and event entry unlocks. There is no fee.
      </PageHeader>
      <Container className="py-10">
        <div className="max-w-2xl bg-surface border border-border p-6 md:p-8">
          <FighterRegisterForm />
        </div>
      </Container>
    </>
  );
}
