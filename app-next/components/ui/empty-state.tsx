import * as React from "react";
import { cn } from "@/lib/cn";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border border-border bg-surface p-10 text-center",
        className,
      )}
    >
      <h2 className="font-display text-2xl text-white tracking-wider">
        {title}
      </h2>
      {description && <p className="mt-3 text-sm text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
