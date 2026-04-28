"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "h-9 w-full rounded-sm bg-white px-3 text-[13px] text-ink-primary",
          "border border-[rgba(0,0,0,0.08)] placeholder:text-ink-tertiary",
          "focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20",
          "disabled:bg-neutral-50 disabled:text-ink-tertiary",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
