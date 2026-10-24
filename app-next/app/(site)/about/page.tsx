import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <>
      <PageHeader eyebrow="W.U.C.O Ireland" title="About us">
        The World United Combat Organisation (W.U.C.O) is building a single
        federation for Irish combat sports. One rulebook. One ranking. One
        passport for every verified fighter in the country.
      </PageHeader>
      <Container className="py-10 max-w-4xl">
        <div className="grid gap-6 md:grid-cols-2">
          <section className="bg-surface border border-border p-6">
            <h2 className="font-display text-xl text-white tracking-wider mb-3">
              Mission
            </h2>
            <p className="text-sm text-muted leading-relaxed">
              Give Irish combat athletes real opportunities to compete, be
              ranked and build an official record. Give clubs the structure to
              operate at a national standard, and give promoters a safe,
              sanctioned stage to run events on.
            </p>
          </section>
          <section className="bg-surface border border-border p-6">
            <h2 className="font-display text-xl text-white tracking-wider mb-3">
              What we do
            </h2>
            <ul className="text-sm text-muted space-y-2">
              <li>— Issue digital fighter passports (IRL-000NNN).</li>
              <li>— Maintain national rankings by weight and class.</li>
              <li>— Sanction events and verify records.</li>
              <li>— Support affiliated gyms with class management tools.</li>
            </ul>
          </section>
        </div>
      </Container>
    </>
  );
}
