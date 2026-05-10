import { createClient } from "@/lib/supabase/server";

export type NotificationRow = {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info" | "success";
  title: string;
  description: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

/**
 * Initial bell drawer payload. RLS scopes to user_id = auth.uid(), so the
 * regular SSR client is safe — no service-role escalation needed.
 * Realtime INSERTs prepend new rows on the client.
 */
export async function fetchRecentNotifications(limit = 30): Promise<NotificationRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, severity, title, description, href, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as NotificationRow[];
}

export async function fetchUnreadCount(): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .is("read_at", null);
  return count ?? 0;
}
