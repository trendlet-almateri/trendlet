"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { loginAction, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandSpinnerInline } from "@/components/brand/brand-spinner";

const initial: LoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? (
        <BrandSpinnerInline size={20} />
      ) : (
        <>
          <span>Sign in</span>
          <ArrowRight className="h-4 w-4" aria-hidden />
        </>
      )}
    </Button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useFormState(loginAction, initial);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder="you@trendslet.com"
          aria-invalid={state.error ? true : undefined}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-[12px] text-navy hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            aria-invalid={state.error ? true : undefined}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-3 flex items-center text-ink-tertiary hover:text-ink-secondary"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {state.error && (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-sm border border-[#F09595] bg-[#FCEBEB] px-3 py-2 text-[12px] text-[#791F1F]"
        >
          {state.error}
        </p>
      )}

      <SubmitButton />

    </form>
  );
}
