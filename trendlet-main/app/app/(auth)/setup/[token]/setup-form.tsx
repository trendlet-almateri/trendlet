"use client";

import { useFormState, useFormStatus } from "react-dom";
import { ArrowRight } from "lucide-react";
import { setupAccountAction, type SetupState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: SetupState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      <span>{pending ? "Creating account…" : "Create account"}</span>
      {!pending && <ArrowRight className="h-4 w-4" aria-hidden />}
    </Button>
  );
}

export function SetupForm({ email }: { email: string }) {
  const [state, formAction] = useFormState(setupAccountAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} readOnly disabled />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="At least 8 characters"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Re-enter password"
        />
      </div>

      <label className="flex items-start gap-2 text-[12px] text-ink-secondary">
        <input
          type="checkbox"
          name="accept"
          value="1"
          required
          className="mt-[2px] h-3.5 w-3.5 rounded-sm border-[rgba(0,0,0,0.15)] text-navy focus:ring-navy/30"
        />
        <span>I accept the terms and acceptable use policy.</span>
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
    </form>
  );
}
