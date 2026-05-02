import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in · Trendlet" };

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
      aria-label="Sign in"
      className="card-mount w-full max-w-[380px] rounded-xl bg-surface px-10 py-11"
      style={{
        border: "0.5px solid rgba(0,0,0,0.08)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 2px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.08)",
      }}
    >
      <div className="mb-10 flex justify-center">
        <Image
          src="/logo.png"
          alt="Trendlet"
          width={180}
          height={52}
          priority
        />
      </div>

      {forbidden && (
        <p
          role="alert"
          className="mb-4 rounded-sm border border-[#F09595] bg-[#FCEBEB] px-3 py-2 text-[12px] text-[#791F1F]"
        >
          You don&rsquo;t have access to that page. Sign in with an authorized account.
        </p>
      )}

      <LoginForm next={next} />

      <footer className="mt-7 border-t border-[rgba(0,0,0,0.08)] pt-4 text-center text-[11px] text-ink-tertiary">
        © 2026 Optify · Powered by Optify.cc
      </footer>
    </section>
  );
}
