import Link from "next/link";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";

export const metadata = { title: "Forgot your password?" };

export default function ForgotPasswordPage() {
  return (
    <>
      <PageHeader eyebrow="Member portal" title="Forgot your password?">
        Enter your email and we&apos;ll send you a reset link. The link works
        once and expires after 10 minutes.
      </PageHeader>
      <Container className="py-10">
        <div className="max-w-md mx-auto bg-surface border border-border p-6 md:p-8">
          <ForgotPasswordForm />
          <p className="mt-6 text-sm text-muted">
            Remembered it?{" "}
            <Link href="/portal/sign-in" className="text-gold underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </Container>
    </>
  );
}
