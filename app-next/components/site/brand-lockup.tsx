import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Props = {
  href?: string;
  className?: string;
  /** 'light' = full-colour logo on a white/light bg · 'dark' = inverted for dark bg */
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
};

const SIZES = {
  sm: { w: 110, h: 40 },
  md: { w: 150, h: 54 },
  lg: { w: 220, h: 80 },
};

export function BrandLockup({
  href = "/",
  className,
  variant = "light",
  size = "md",
}: Props) {
  const s = SIZES[size];
  const content = (
    <span className={cn("inline-flex items-center", className)}>
      <Image
        src="/brand/wuco-full-logo-transparent.png"
        alt="W.U.C.O Ireland"
        width={s.w}
        height={s.h}
        priority
        className={cn(
          "object-contain",
          variant === "dark" && "brightness-0 invert",
        )}
        style={{ height: s.h, width: "auto" }}
      />
    </span>
  );
  return href ? (
    <Link href={href} aria-label="W.U.C.O Ireland home" className="inline-flex">
      {content}
    </Link>
  ) : (
    content
  );
}
