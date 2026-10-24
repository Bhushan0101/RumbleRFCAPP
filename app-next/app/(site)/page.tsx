import { Hero } from "@/components/site/hero";
import { QuickServices } from "@/components/site/quick-services";
import { RankingsPanel } from "@/components/site/rankings-panel";
import { EventsPanel } from "@/components/site/events-panel";
import { ActionCards } from "@/components/site/action-cards";
import { StatsBar } from "@/components/site/stats-bar";
import { Container } from "@/components/ui/container";

export default function HomePage() {
  return (
    <>
      <Hero />
      <QuickServices />
      <section className="bg-bg py-10">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <RankingsPanel />
            <EventsPanel />
          </div>
        </Container>
      </section>
      <ActionCards />
      <StatsBar />
    </>
  );
}
