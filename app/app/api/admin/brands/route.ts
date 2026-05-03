import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-role";
import {
  fetchBrandsForAdmin,
  fetchAssignmentsByEmployee,
} from "@/lib/queries/brands";
import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function GET() {
  await requireAdmin();
  const [brands, assignmentsByEmployee] = await Promise.all([
    fetchBrandsForAdmin(),
    fetchAssignmentsByEmployee(),
  ]);
  return NextResponse.json({ brands, assignmentsByEmployee });
}

const patchSchema = z.object({
  brand_id: z.string().uuid(),
  region: z.enum(["US", "EU", "KSA", "GLOBAL"]).nullable().optional(),
  primary_assignee_id: z
    .string()
    .refine((v) => v === "" || /^[0-9a-f-]{36}$/i.test(v), "Invalid id.")
    .optional(),
});

export async function PATCH(req: Request) {
  await requireAdmin();

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const sb = createServiceClient();
  const { brand_id, region, primary_assignee_id } = parsed.data;

  if (region !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb.from("brands") as any)
      .update({ region })
      .eq("id", brand_id);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
  }

  if (primary_assignee_id !== undefined) {
    // Mirror updateBrandAction: delete existing primary, then upsert if a
    // new one was chosen. DELETE (not UPDATE) avoids the
    // enforce_brand_region trigger rejecting a stale (user, region) pair.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: clearErr } = await (sb.from("brand_assignments") as any)
      .delete()
      .eq("brand_id", brand_id)
      .eq("is_primary", true);
    if (clearErr) {
      return NextResponse.json({ ok: false, error: clearErr.message }, { status: 400 });
    }

    if (primary_assignee_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: upsertErr } = await (sb.from("brand_assignments") as any).upsert(
        {
          brand_id,
          user_id: primary_assignee_id,
          is_primary: true,
        },
        { onConflict: "brand_id,user_id" },
      );
      if (upsertErr) {
        return NextResponse.json(
          { ok: false, error: upsertErr.message },
          { status: 400 },
        );
      }

      // Backfill: route this brand's existing unassigned sub_orders to the
      // new primary assignee so /queue and /eu-fulfillment views populate
      // immediately. brand_assignments only steers *future* webhook
      // ingests; pre-existing rows need this UPDATE to fan out.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb.from("sub_orders") as any)
        .update({
          assigned_employee_id: primary_assignee_id,
          is_unassigned: false,
        })
        .eq("brand_id", brand_id)
        .eq("is_unassigned", true);
    } else {
      // Cleared the primary — surface this brand's previously-routed rows
      // back to /orders/unassigned by clearing assigned_employee_id and
      // flipping is_unassigned on. Only touches rows whose current
      // assignee is no longer the primary (since we just removed them).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb.from("sub_orders") as any)
        .update({
          assigned_employee_id: null,
          is_unassigned: true,
        })
        .eq("brand_id", brand_id)
        .eq("is_unassigned", false);
    }
  }

  revalidatePath("/admin/brands");
  return NextResponse.json({ ok: true });
}
