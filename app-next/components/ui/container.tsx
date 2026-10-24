import * as React from "react";
import { cn } from "@/lib/cn";

export function Container({
  className,
  wide = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { wide?: boolean }) {
  return (
    <div
      className={cn(
        "mx-auto px-6 lg:px-8",
        wide ? "max-w-[1500px]" : "max-w-[1400px]",
        className,
      )}
      {...props}
    />
  );
}
