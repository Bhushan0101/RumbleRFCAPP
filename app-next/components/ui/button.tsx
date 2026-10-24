import * as React from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonStyles = cva(
  "inline-flex items-center justify-center gap-3 font-display font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-full",
  {
    variants: {
      variant: {
        primary:
          "bg-emerald text-white border border-emerald hover:bg-emerald-hi hover:border-emerald-hi",
        gold:
          "bg-gold text-bg border border-gold hover:bg-gold-hi hover:border-gold-hi",
        outline:
          "bg-transparent text-white border border-gold hover:bg-gold hover:text-bg",
        ghost:
          "bg-transparent text-white border border-border hover:border-gold hover:text-gold",
      },
      size: {
        sm: "px-4 py-2 text-[11px]",
        md: "px-6 py-3 text-[12px]",
        lg: "px-8 py-4 text-[13px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonStyles>;

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonStyles({ variant, size }), className)}
      {...props}
    />
  );
}

type LinkButtonProps = React.ComponentProps<typeof Link> &
  VariantProps<typeof buttonStyles>;

export function LinkButton({
  className,
  variant,
  size,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={cn(buttonStyles({ variant, size }), className)}
      {...props}
    />
  );
}
