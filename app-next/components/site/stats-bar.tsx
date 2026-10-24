import { Container } from "@/components/ui/container";
import { prisma } from "@/lib/prisma";
import { Users, Building2, Calendar, BarChart3, Globe, ShieldCheck } from "lucide-react";

export async function StatsBar() {
  const [fighters, gyms, events] = await Promise.all([
    prisma.athlete.count().catch(() => 0),
    prisma.gym.count({ where: { status: "active" } }).catch(() => 0),
    prisma.event.count().catch(() => 0),
  ]);

  const stats = [
    { icon: Users, value: String(fighters || 0), label: "REGISTERED\nFIGHTERS" },
    { icon: Building2, value: String(gyms || 0), label: "AFFILIATED\nCLUBS" },
    { icon: Calendar, value: String(events || 0), label: "EVENTS\nSCHEDULED" },
    { icon: BarChart3, value: "10", label: "WEIGHT\nDIVISIONS" },
    { icon: Globe, value: "IRL", label: "NATIONAL\nRANKINGS" },
    { icon: ShieldCheck, value: "★", label: "SAFETY &\nGOVERNANCE" },
  ];

  return (
    <section className="bg-emerald text-white rounded-2xl mx-6 lg:mx-8 overflow-hidden">
      <Container className="py-6 lg:!px-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-y-4">
          {stats.map(({ icon: Icon, value, label }, i) => (
            <div
              key={label}
              className={`flex items-center gap-3 px-4 ${
                i < 5 ? "border-r border-white/15" : ""
              } ${i === 1 && i < 2 ? "sm:border-r-0" : ""}`}
            >
              <Icon className="size-8 flex-none text-gold stroke-[1.5]" />
              <div className="min-w-0">
                <div className="font-display text-2xl font-black leading-none">
                  {value}
                </div>
                <div className="text-[9.5px] tracking-wider mt-1 whitespace-pre-line leading-tight">
                  {label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
