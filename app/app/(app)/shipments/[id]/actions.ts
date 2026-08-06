"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { sendMilestoneNow } from "@/lib/shipping/send-dhl-updates";
import type { CustomerMessageKey } from "@/lib/shipping/dhl-customer-messages";

export type ActionResult = { ok: boolean; error: string | null };

/** Attach customer orders to a shipment after it was created. */
export async function addOrdersToShipmentAction(
  shipmentId: string,
  subOrderIds: string[],
): Promise<ActionResult> {
  await requireAdmin();
  if (subOrderIds.length === 0) return { ok: false, error: "Pick at least one order." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any;
  const { error } = await sb
    .from("shipment_sub_orders")
    .upsert(
      subOrderIds.map((id) => ({ shipment_id: shipmentId, sub_order_id: id })),
      { onConflict: "shipment_id,sub_order_id" },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/shipments/${shipmentId}`);
  return { ok: true, error: null };
}

/**
 * Detach an order. The message log is left alone on purpose — if that customer
 * was already told their shipment arrived, deleting the record would let the
 * poller message them again should the order be re-attached.
 */
export async function removeOrderFromShipmentAction(
  shipmentId: string,
  subOrderId: string,
): Promise<ActionResult> {
  await requireAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any;
  const { error } = await sb
    .from("shipment_sub_orders")
    .delete()
    .eq("shipment_id", shipmentId)
    .eq("sub_order_id", subOrderId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/shipments/${shipmentId}`);
  return { ok: true, error: null };
}

/** Send one milestone by hand — the override when DHL is late, wrong or silent. */
export async function sendMilestoneAction(
  shipmentId: string,
  subOrderId: string,
  key: CustomerMessageKey,
): Promise<ActionResult> {
  await requireAdmin();
  const res = await sendMilestoneNow({ shipmentId, subOrderId, key });
  if (res.ok) revalidatePath(`/shipments/${shipmentId}`);
  return res;
}
