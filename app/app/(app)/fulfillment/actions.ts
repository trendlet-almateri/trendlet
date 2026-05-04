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
  // Set when the user clicks an explicit "final" button (Mark
  // delivered / Out of stock / Deliver to warehouse for sourcing).
  // Stamps marked_done_at so the row routes to the Completed tab.
  markDone: z.boolean().optional(),
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
  markDone?: boolean;
}): Promise<SetStatusState> {
  const user = await requireRole(["fulfiller", "warehouse", "sourcing", "admin"]);

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const isAdmin = user.roles.includes("admin");
  const sb = isAdmin ? createServiceClient() : createClient();

  // The service-role client has no auth.uid(), so the enforce_status_whitelist
  // trigger can't auto-populate status_changed_by. Set it explicitly when
  // we're acting as admin via the service client.
  const update: {
    status: string;
    status_changed_by?: string;
    marked_done_at?: string;
  } = {
    status: parsed.data.status,
  };
  if (isAdmin) update.status_changed_by = user.id;
  if (parsed.data.markDone) update.marked_done_at = new Date().toISOString();

  const { error } = await sb
    .from("sub_orders")
    .update(update)
    .eq("id", parsed.data.subOrderId);

  if (error) return { ok: false, error: error.message };

  // Fire WhatsApp template if the new status has notifies_customer = true.
  // No-op when twilio_template_sid is NULL on the status row.
  void notifyCustomerOnStatusChange(parsed.data.subOrderId, parsed.data.status).catch((e) => {
    console.error("[fulfillment] twilio notify failed", e);
  });

  // Same SubOrderRow component renders in /fulfillment, /queue, /pipeline,
  // /eu-fulfillment — revalidate all four so a status change in one view
  // doesn't leave the others stale until a manual refresh. This was the
  // root cause of "after I press a button the next button doesn't show":
  // /eu-fulfillment was missing here, so its server-rendered tab data
  // never refreshed when fulfiller advanced an order, leaving the row
  // stuck in its previous tab and the next button invisible.
  revalidatePath("/fulfillment");
  revalidatePath("/queue");
  revalidatePath("/pipeline");
  revalidatePath("/eu-fulfillment");
  return { ok: true, error: null };
}
