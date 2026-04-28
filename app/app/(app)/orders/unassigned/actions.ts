"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";

const schema = z.object({ subOrderId: z.string().uuid() });

export type AutoAssignState = { error: string | null; assignedTo: string | null };

export async function autoAssignAction(
  _prev: AutoAssignState,
  formData: FormData,
): Promise<AutoAssignState> {
  await requireAdmin();

  const parsed = schema.safeParse({ subOrderId: formData.get("subOrderId") });
  if (!parsed.success) return { error: "Invalid sub-order id.", assignedTo: null };

  const sb = createServiceClient();
  const { data, error } = await sb.rpc("auto_assign_sub_order", {
    p_sub_order_id: parsed.data.subOrderId,
  });

  if (error) {
    return { error: error.message, assignedTo: null };
  }

  revalidatePath("/orders/unassigned");
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { error: null, assignedTo: data ?? null };
}
