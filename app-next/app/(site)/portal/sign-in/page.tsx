import Link from "next/link";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { SignInForm } from "@/components/forms/sign-in-form";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <>
      <PageHeader eyebrow="Member portal" title="Back in your corner.">
        Sign in to manage your profile, bookings and approvals.
      </PageHeader>
      <Container className="py-10">
        <div className="max-w-md mx-auto bg-surface border border-border p-6 md:p-8">
          <SignInForm />
          <p className="mt-6 text-sm text-muted">
            New to W.U.C.O?{" "}
            <Link href="/register" className="text-gold underline">
              Create a fighter application
            </Link>
          </p>
        </div>
      </Container>
    </>
  );
}
