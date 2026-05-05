import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { createClient } from "@/lib/supabase/server";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Set up your account · Trendslet Operations" };

export default async function SetupPage() {
  // Session is already established by /auth/callback (Route Handler).
  // Server Components can't set cookies, so verifyOtp must happen there.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <section
      aria-labelledby="setup-heading"
      className="w-full max-w-[380px] rounded-xl bg-surface px-10 py-11 shadow-login"
      style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}
    >
      <div className="mb-8">
        <Logo />
      </div>

      <h1 id="setup-heading" className="text-[22px] font-medium text-ink-primary">
        Set up your account
      </h1>
      <p className="mb-7 mt-1 text-[13px] text-ink-secondary">
        Create a password to finish activating your Trendslet account.
      </p>

      {user ? (
        <SetupForm email={user.email ?? ""} />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="rounded-sm border border-[#F09595] bg-[#FCEBEB] px-3 py-2 text-[12px] text-[#791F1F]">
            This invitation link is invalid or has expired. Ask your admin to resend the invitation.
          </p>
          <Link
            href="/login"
            className="text-center text-[13px] text-navy hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      )}
    </section>
  );
}
