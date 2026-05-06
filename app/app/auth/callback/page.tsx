"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const supabase = createClient();
    const code = searchParams.get("code");

    async function handle() {
      if (code) {
        // PKCE flow — exchange the one-time code for a session
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          router.replace("/login?error=invalid_link");
          return;
        }
      }

      // Implicit flow fallback — getSession() reads the #access_token hash
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/setup/invited");
      } else {
        router.replace("/login?error=invalid_link");
      }
    }

    handle();
  }, [router, searchParams]);

  return null;
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackHandler />
    </Suspense>
  );
}
