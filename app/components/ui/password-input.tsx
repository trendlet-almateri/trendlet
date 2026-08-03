"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

/**
 * Single shared password input with a visibility toggle. The icon reflects
 * the field's CURRENT state (not the action):
 *   - hidden  (type="password") → EyeOff  (crossed-out eye)
 *   - visible (type="text")     → Eye     (open eye)
 * The button's aria-label still describes the action ("Show"/"Hide password").
 *
 * Use this for every password/secret field so the behaviour stays consistent.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [show, setShow] = React.useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={show ? "text" : "password"}
          className={cn("pr-10", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute inset-y-0 right-3 flex items-center text-ink-tertiary hover:text-ink-secondary"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <Eye className="h-4 w-4" aria-hidden /> : <EyeOff className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
