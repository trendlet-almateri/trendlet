import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in · Trendslet Operations" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const next = searchParams.next?.startsWith("/") ? searchParams.next : "/";
  const forbidden = searchParams.error === "forbidden";

  return (
    <section
      aria-labelledby="login-heading"
      className="w-full max-w-[380px] rounded-xl bg-surface px-10 py-11 shadow-login"
      style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}
    >
      <div className="mb-8">
        <Logo />
      </div>

      <h1 id="login-heading" className="mb-7 text-[22px] font-medium text-ink-primary">
        Welcome back
      </h1>

      {forbidden && (
        <p
          role="alert"
          className="mb-4 rounded-sm border border-[#F09595] bg-[#FCEBEB] px-3 py-2 text-[12px] text-[#791F1F]"
        >
          You don&rsquo;t have access to that page. Sign in with an authorized account.
        </p>
      )}

      <LoginForm next={next} />

      <footer className="mt-7 flex items-center justify-between border-t border-[rgba(0,0,0,0.08)] pt-4 text-[11px] text-ink-tertiary">
        <span>© 2026 Optify · Powered by Optify.cc</span>
      </footer>
    </section>
  );
}
