"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notifyCustomerOnStatusChange } from "@/lib/integrations/twilio";

const KSA_STATUSES = ["arrived_in_ksa", "out_for_delivery", "delivered", "returned"] as const;

const schema = z.object({
  subOrderId: z.string().uuid(),
  status: z.enum(KSA_STATUSES),
});

export type SetStatusState = { error: string | null; ok: boolean };

/**
 * KSA operator (or admin) sets a delivery status. The DB enforces the
 * role/status whitelist via enforce_status_whitelist trigger, so a wrong
 * transition surfaces as a Postgres error rather than passing silently.
 *
 * Uses the regular SSR client (not service-role) so RLS scopes the update
 * to rows the operator owns. Admins bypass via jwt_is_admin in the policy.
 */
export async function setDeliveryStatusAction(input: {
  subOrderId: string;
  status: (typeof KSA_STATUSES)[number];
}): Promise<SetStatusState> {
  const user = await requireRole(["ksa_operator", "admin"]);

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input.", ok: false };

  // Use regular client for non-admins so RLS narrows to their own rows;
  // admins use service-role for the same reason as elsewhere in the app
  // (their JWT may not yet carry the role claim on first sign-in).
  const sb = user.roles.includes("admin") ? createServiceClient() : createClient();

  const { error } = await sb
    .from("sub_orders")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.subOrderId);

  if (error) return { error: error.message, ok: false };

  // Fire WhatsApp template if the new status has notifies_customer = true.
  // No-op (logged as 'skipped') when twilio_template_sid is NULL.
  // Don't block the user response on Twilio outcome.
  void notifyCustomerOnStatusChange(parsed.data.subOrderId, parsed.data.status).catch((e) => {
    console.error("[deliveries] twilio notify failed", e);
  });

  revalidatePath("/deliveries");
  return { error: null, ok: true };
}
