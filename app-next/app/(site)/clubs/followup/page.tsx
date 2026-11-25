import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { FollowupForm } from "@/components/forms/followup-form";

type Search = Promise<{ token?: string }>;

export const metadata = { title: "W.U.C.O club follow-up" };

export default async function FollowupPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const { token } = await searchParams;
  let errorMessage = "";
  let data:
    | {
        token: string;
        gymName: string;
        contactName: string;
        allQuestions: {
          id: number;
          question: string;
          answer: string;
          answeredAt: string | null;
          askedAt: string;
        }[];
      }
    | null = null;

  if (!token) {
    errorMessage = "Open the follow-up link your W.U.C.O admin sent.";
  } else {
    const row = await prisma.gymOnboardingToken.findUnique({
      where: { token },
      include: {
        enquiry: {
          include: { followups: { orderBy: { askedAt: "asc" } } },
        },
      },
    });
    if (!row) errorMessage = "This follow-up link is not valid.";
    else if (row.kind !== "followup") errorMessage = "This link is not a follow-up link.";
    else if (row.usedAt) errorMessage = "This link has already been used.";
    else if (row.expiresAt * 1000 < Date.now())
      errorMessage = "This follow-up link has expired.";
    else {
      data = {
        token,
        gymName: row.enquiry.gymName,
        contactName: row.enquiry.contactName,
        allQuestions: row.enquiry.followups.map((f) => ({
          id: f.id,
          question: f.question,
          answer: f.answer,
          answeredAt: f.answeredAt?.toISOString() ?? null,
          askedAt: f.askedAt.toISOString(),
        })),
      };
    }
  }

  return (
    <>
      <PageHeader eyebrow="W.U.C.O follow-up" title="Additional information">
        {data
          ? `Hi ${data.contactName} — please answer the questions below for ${data.gymName}.`
          : "Open the follow-up link your W.U.C.O admin sent."}
      </PageHeader>
      <Container className="py-10">
        {errorMessage ? (
          <div className="bg-red-500/10 border border-red-500 text-red-200 p-4 text-sm rounded-lg max-w-2xl">
            {errorMessage}
          </div>
        ) : data ? (
          <FollowupForm
            token={data.token}
            gymName={data.gymName}
            questions={data.allQuestions}
          />
        ) : null}
      </Container>
    </>
  );
}
