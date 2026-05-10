"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirm: z.string(),
    accept: z.string().optional(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match.",
    path: ["confirm"],
  })
  .refine((d) => d.accept === "1", {
    message: "You must accept the terms to continue.",
    path: ["accept"],
  });

export type SetupState = { error: string | null };

export async function setupAccountAction(
  _prev: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const parsed = schema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
    accept: formData.get("accept") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Invitation expired or invalid. Ask your admin to resend it." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: error.message };
  }

  await supabase
    .from("profiles")
    .update({ is_active: true })
    .eq("id", user.id);

  // Mark the matching invitation as accepted so the link can't be reused.
  // Service role required: invitations is admin-only via RLS.
  if (user.email) {
    const sb = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from("invitations") as any)
      .update({ accepted_at: new Date().toISOString() })
      .eq("email", user.email)
      .is("accepted_at", null);
  }

  redirect("/");
}
