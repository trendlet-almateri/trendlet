import { createServiceClient } from "@/lib/supabase/server";

export type NotificationSeverity = "critical" | "warning" | "info" | "success";

export type WriteNotificationInput = {
  type: string;
  severity: NotificationSeverity;
  title: string;
  description?: string | null;
  href?: string | null;
};

/**
 * Insert a notification row for every admin user.
 *
 * Always call with `void writeOrderNotification(...)` — this is
 * fire-and-forget so it never blocks the webhook response.
 * All errors are swallowed and logged; a notification failure must
 * never cause a webhook to return a non-200.
 */
export async function writeOrderNotification(
  input: WriteNotificationInput,
): Promise<void> {
  try {
    const sb = createServiceClient();

    const { data: admins } = await sb
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!admins?.length) return;

    await sb.from("notifications").insert(
      admins.map((a) => ({
        user_id: a.user_id,
        type: input.type,
        severity: input.severity,
        title: input.title,
        description: input.description ?? null,
        href: input.href ?? null,
      })),
    );
  } catch (err) {
    console.error("[writeOrderNotification] failed silently", err);
  }
}
