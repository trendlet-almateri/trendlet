"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ email: z.string().email() });

export type ForgotState = { sent: boolean; error: string | null };

export async function forgotPasswordAction(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    // Same neutral response — don't leak whether email is valid syntax-wise.
    return { sent: true, error: null };
  }

  const supabase = createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/reset-password`,
  });

  // Always return "sent" — never disclose whether the email exists.
  return { sent: true, error: null };
}
