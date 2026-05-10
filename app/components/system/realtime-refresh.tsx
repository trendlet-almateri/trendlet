"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  /** Tables to watch. Defaults to orders + sub_orders. */
  tables?: string[];
};

/**
 * Invisible client component. Subscribes to Supabase Realtime INSERT/UPDATE
 * on the given tables and calls router.refresh() on any change so the parent
 * server component re-fetches fresh data automatically.
 */
export function RealtimeRefresh({ tables = ["orders", "sub_orders"] }: Props) {
  const router = useRouter();

  useEffect(() => {
    const sb = createClient();

    const channel = tables.reduce(
      (ch, table) =>
        ch
          .on("postgres_changes", { event: "INSERT", schema: "public", table }, () =>
            router.refresh(),
          )
          .on("postgres_changes", { event: "UPDATE", schema: "public", table }, () =>
            router.refresh(),
          ),
      sb.channel(`realtime-refresh-${tables.join("-")}`),
    );

    channel.subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [router, tables]);

  return null;
}
