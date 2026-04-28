import { Logo } from "@/components/brand/logo";
import { ForgotForm } from "./forgot-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Forgot password · Trendslet Operations" };

export default function ForgotPasswordPage() {
  return (
    <section
      aria-labelledby="forgot-heading"
      className="w-full max-w-[380px] rounded-xl bg-surface px-10 py-11 shadow-login"
      style={{ border: "0.5px solid rgba(0,0,0,0.08)" }}
    >
      <div className="mb-8">
        <Logo />
      </div>

      <h1 id="forgot-heading" className="text-[22px] font-medium text-ink-primary">
        Reset your password
      </h1>
      <p className="mb-7 mt-1 text-[13px] text-ink-secondary">
        Enter the email tied to your account and we&rsquo;ll send a reset link.
      </p>

      <ForgotForm />
    </section>
  );
}
