"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-navy-deep text-white hover:bg-[#063367] hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(12,68,124,0.18)] active:translate-y-0 active:bg-[#021d3a] active:scale-[0.98] disabled:bg-[#7a92ad] disabled:translate-y-0 disabled:shadow-none",
  secondary:
    "bg-white text-ink-primary hairline hover:bg-neutral-50 hover:border-hairline-strong disabled:bg-neutral-100 disabled:text-ink-tertiary",
  ghost:
    "bg-transparent text-ink-secondary hover:bg-black/5 hover:text-ink-primary disabled:text-ink-tertiary",
  danger:
    "bg-[#791F1F] text-white hover:bg-[#601717] hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(121,31,31,0.18)] active:translate-y-0 active:scale-[0.98] disabled:bg-[#a76b6b] disabled:translate-y-0 disabled:shadow-none",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[12px]",
  md: "h-9 px-4 text-[13px]",
  lg: "h-10 px-5 text-[13px]",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-all duration-200 ease-out motion-reduce:transition-none motion-reduce:transform-none disabled:cursor-not-allowed will-change-transform",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
