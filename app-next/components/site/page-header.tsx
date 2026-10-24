import * as React from "react";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/cn";

export function PageHeader({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden border-b border-border bg-surface",
        className,
      )}
    >
      <Container className="py-14 lg:py-20">
        {eyebrow && (
          <p className="font-display text-[11px] tracking-[0.4em] text-gold uppercase mb-3">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display font-black text-4xl md:text-5xl lg:text-6xl text-white uppercase tracking-wider">
          {title}
        </h1>
        {children && (
          <div className="mt-5 text-muted max-w-2xl text-sm leading-relaxed">
            {children}
          </div>
        )}
      </Container>
    </section>
  );
}
