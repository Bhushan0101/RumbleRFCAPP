// Lightweight onboarding page — the full product/class/image flow lives in the
// member portal after approval. This public page accepts a token, pre-fills
// the gym name, and lets the contact submit minimal onboarding details.
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { OnboardingForm } from "@/components/forms/onboarding-form";

type Search = Promise<{ token?: string }>;

export const metadata = { title: "Gym onboarding" };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const { token } = await searchParams;
  let enquiry = null;
  let errorMessage = "";
  if (!token) {
    errorMessage = "Open the onboarding link your W.U.C.O admin sent you.";
  } else {
    const row = await prisma.gymOnboardingToken.findUnique({
      where: { token },
      include: { enquiry: true },
    });
    if (!row) errorMessage = "This onboarding link is not valid.";
    else if (row.usedAt) errorMessage = "This onboarding link has already been used.";
    else if (row.expiresAt * 1000 < Date.now())
      errorMessage = "This onboarding link has expired.";
    else enquiry = row.enquiry;
  }

  return (
    <>
      <PageHeader eyebrow="Welcome to W.U.C.O" title="Gym onboarding">
        {enquiry
          ? `${enquiry.contactName}, finish setting up ${enquiry.gymName}.`
          : "Open the invitation link your W.U.C.O admin sent."}
      </PageHeader>
      <Container className="py-10">
        {errorMessage ? (
          <div className="bg-red-500/10 border border-red-500 text-red-200 p-4 text-sm">
            {errorMessage}
          </div>
        ) : enquiry && token ? (
          <OnboardingForm
            token={token}
            gymName={enquiry.gymName}
            city={enquiry.city}
          />
        ) : null}
      </Container>
    </>
  );
}
