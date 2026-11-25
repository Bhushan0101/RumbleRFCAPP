import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { ResetPasswordForm } from "@/components/forms/reset-password-form";

export const metadata = { title: "Reset your password" };

type Search = Promise<{ token?: string }>;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const { token } = await searchParams;
  let state: "ok" | "missing" | "unknown" | "used" | "expired" = "ok";

  if (!token) {
    state = "missing";
  } else {
    // Peek at the token so we can tell the user WHY the link isn't working.
    // We don't expose anything the holder of the token doesn't already know.
    const row = await prisma.passwordReset.findUnique({ where: { token } });
    if (!row) state = "unknown";
    else if (row.usedAt) state = "used";
    else if (row.expiresAt * 1000 < Date.now()) state = "expired";
  }

  const msg: Record<typeof state, string> = {
    ok: "",
    missing: "Open the reset link from your email.",
    unknown: "This reset link isn't valid. Request a new one.",
    used: "This reset link has already been used. Request a new one.",
    expired: "This reset link has expired. Request a new one.",
  };

  return (
    <>
      <PageHeader eyebrow="Member portal" title="Reset your password">
        {state === "ok"
          ? "Pick a new password below. This link works once and is valid for 10 minutes."
          : msg[state]}
      </PageHeader>
      <Container className="py-10">
        <div className="max-w-md mx-auto bg-surface border border-border p-6 md:p-8 space-y-4">
          {state !== "ok" ? (
            <>
              <p className="text-sm text-red-200 bg-red-500/10 border border-red-500 rounded px-3 py-2">
                {msg[state]}
              </p>
              <Link
                href="/portal/forgot-password"
                className="inline-block bg-gold text-bg px-5 py-2.5 font-display font-bold text-xs tracking-wider uppercase rounded-full hover:bg-gold-hi"
              >
                Request a new link
              </Link>
            </>
          ) : (
            <ResetPasswordForm token={token!} />
          )}
          <p className="text-sm text-muted">
            <Link href="/portal/sign-in" className="text-gold underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </Container>
    </>
  );
}
