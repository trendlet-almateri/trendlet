"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Auth callback page — handles Supabase's implicit flow where tokens arrive
 * as hash fragments (#access_token=...). Route Handlers never see hash
 * fragments (browser-only), so this must be a client component.
 *
 * Supabase JS SDK detects the hash automatically on getSession().
 * Invite links always land here → redirect to /setup/invited.
 */
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/setup/invited");
      } else {
        router.replace("/login?error=invalid_link");
      }
    });
  }, [router]);

  return null;
}
