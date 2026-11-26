import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { FighterRegisterForm } from "@/components/forms/fighter-register-form";

export const metadata = {
  title: "Register as a fighter",
  description: "Join W.U.C.O Ireland and start your official fight record.",
};

export default async function RegisterPage() {
  const gyms = await prisma.gym.findMany({
    where: { status: "active" },
    select: { id: true, name: true, city: true },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <PageHeader
        eyebrow="Your next chapter"
        title="Register as a fighter"
      >
        Create your fighter application. An administrator reviews it before your
        profile is published and event entry unlocks. There is no fee.
      </PageHeader>
      <Container className="py-6 md:py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(320px,0.9fr)_1.4fr] items-start">
          <div className="hidden lg:block relative w-full overflow-hidden rounded-2xl border border-border bg-surface lg:order-first lg:self-start aspect-[632/888]">
            <Image
              src="/brand/fighter-portrait.png"
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover object-top"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg/70 via-transparent to-transparent" />
          </div>
          <div className="bg-surface border border-border p-4 sm:p-6 md:p-8 rounded-2xl">
            <FighterRegisterForm gyms={gyms} />
          </div>
        </div>
      </Container>
    </>
  );
}
