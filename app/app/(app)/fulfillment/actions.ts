"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notifyCustomerOnStatusChange } from "@/lib/integrations/twilio";
import { STATUSES } from "@/lib/constants";

const ALLOWED_STATUSES = STATUSES.map((s) => s.code) as readonly string[];

const schema = z.object({
  subOrderId: z.string().uuid(),
  status: z.string().refine((s) => ALLOWED_STATUSES.includes(s), {
    message: "Unknown status.",
  }),
});

export type SetStatusState = { ok: boolean; error: string | null };

/**
 * Set a sub-order's status from the fulfiller / warehouse / sourcing
 * queues. Reused across views — each role's UI only renders the
 * buttons their whitelist allows (see lib/workflow/sub-order-transitions.ts).
 *
 * Authorization is layered:
 *   1. requireRole gates the route entry
 *   2. RLS narrows the .update() to rows the user owns
 *   3. The DB enforce_status_whitelist trigger blocks bad transitions
 *
 * On success, the customer-notification fire-and-forget mirror of
 * setDeliveryStatusAction.
 */
export async function setSubOrderStatusAction(input: {
  subOrderId: string;
  status: string;
}): Promise<SetStatusState> {
  const user = await requireRole(["fulfiller", "warehouse", "sourcing", "admin"]);

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const sb = user.roles.includes("admin") ? createServiceClient() : createClient();

  const { error } = await sb
    .from("sub_orders")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.subOrderId);

  if (error) return { ok: false, error: error.message };

  // Fire WhatsApp template if the new status has notifies_customer = true.
  // No-op when twilio_template_sid is NULL on the status row.
  void notifyCustomerOnStatusChange(parsed.data.subOrderId, parsed.data.status).catch((e) => {
    console.error("[fulfillment] twilio notify failed", e);
  });

  // Same SubOrderRow component renders in /fulfillment, /queue, /pipeline —
  // revalidate all three so a status change in one view doesn't leave the
  // others stale until a manual refresh.
  revalidatePath("/fulfillment");
  revalidatePath("/queue");
  revalidatePath("/pipeline");
  return { ok: true, error: null };
}
