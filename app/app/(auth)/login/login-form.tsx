"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { ArrowRight, Info } from "lucide-react";
import { loginAction, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: LoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      <span>{pending ? "Signing in…" : "Sign in"}</span>
      {!pending && <ArrowRight className="h-4 w-4" aria-hidden />}
    </Button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useFormState(loginAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
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
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          aria-invalid={state.error ? true : undefined}
        />
      </div>

      <label className="flex items-center gap-2 text-[12px] text-ink-secondary">
        <input
          type="checkbox"
          name="remember"
          value="1"
          className="h-3.5 w-3.5 rounded-sm border-[rgba(0,0,0,0.15)] text-navy focus:ring-navy/30"
        />
        <span>Keep me signed in for 30 days</span>
      </label>

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

      <div className="flex items-start gap-2 rounded-md bg-[#F1EFE8] px-3 py-2.5 text-[12px] text-ink-secondary">
        <Info className="mt-[1px] h-3.5 w-3.5 shrink-0 text-ink-tertiary" aria-hidden />
        <span>Access is invite-only. Contact your admin if you need an account.</span>
      </div>
    </form>
  );
}
