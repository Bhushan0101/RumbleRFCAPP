import Link from "next/link";
import { Container } from "@/components/ui/container";
import {
  ClipboardList,
  BarChart3,
  CalendarCheck,
  Users,
  FileText,
  ShieldCheck,
} from "lucide-react";

const SERVICES = [
  { icon: ClipboardList, label: "FIGHTER\nREGISTRATION", href: "/register" },
  { icon: BarChart3, label: "NATIONAL\nRANKINGS", href: "/rankings" },
  { icon: CalendarCheck, label: "EVENTS &\nCHAMPIONSHIPS", href: "/events" },
  { icon: Users, label: "CLUB\nDIRECTORY", href: "/clubs" },
  { icon: FileText, label: "PROMOTER\nSUPPORT", href: "/promoters" },
  { icon: ShieldCheck, label: "RULES &\nSAFETY", href: "/about" },
];

export function QuickServices() {
  return (
    <section className="bg-bg">
      <Container className="py-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 bg-surface border border-border rounded-2xl overflow-hidden">
          {SERVICES.map(({ icon: Icon, label, href }, i) => (
            <Link
              key={label}
              href={href}
              className={`flex flex-col items-center justify-center gap-2.5 py-6 px-3 text-center text-white border-border transition-colors hover:bg-surface-3 ${
                i % 2 === 0 ? "border-r sm:border-r" : "sm:border-r"
              } ${i < 4 ? "border-b sm:border-b lg:border-b-0" : ""} ${
                i === 5 ? "sm:border-r-0 lg:border-r-0" : ""
              } ${i === 2 ? "lg:border-r sm:border-r-0" : ""}`}
            >
              <Icon className="size-7 text-gold stroke-[1.3]" />
              <span className="font-display text-[11px] font-bold tracking-wider leading-tight whitespace-pre-line">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
