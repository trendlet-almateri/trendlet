"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { ArrowRight, CheckCircle } from "lucide-react";
import { forgotPasswordAction, type ForgotState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ForgotState = { sent: false, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      <span>{pending ? "Sending…" : "Send reset link"}</span>
      {!pending && <ArrowRight className="h-4 w-4" aria-hidden />}
    </Button>
  );
}

export function ForgotForm() {
  const [state, formAction] = useFormState(forgotPasswordAction, initial);

  if (state.sent) {
    return (
      <div className="flex flex-col gap-4">
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-[#5DCAA5] bg-[#E1F5EE] px-3 py-2.5 text-[12px] text-[#0F6E56]"
        >
          <CheckCircle className="mt-[1px] h-4 w-4 shrink-0" aria-hidden />
          <span>If this email exists, you&rsquo;ll receive a reset link shortly.</span>
        </div>
        <Link
          href="/login"
          className="text-center text-[13px] text-navy hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@trendslet.com"
        />
      </div>

      <SubmitButton />

      <Link
        href="/login"
        className="text-center text-[12px] text-ink-tertiary hover:text-ink-secondary"
      >
        ← Back to sign in
      </Link>
    </form>
  );
}
