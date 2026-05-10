"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Invisible client component that subscribes to Supabase Realtime on the
 * orders and sub_orders tables. When any INSERT or UPDATE arrives it calls
 * router.refresh() so the server component re-fetches fresh data —
 * no manual page refresh needed.
 */
export function OrdersRealtime() {
  const router = useRouter();

  useEffect(() => {
    const sb = createClient();

    const refresh = () => router.refresh();

    const channel = sb
      .channel("orders-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" },    refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" },    refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sub_orders"}, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sub_orders"}, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "customers" }, refresh)
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [router]);

  return null;
}
