import { BrandSpinner } from "@/components/spinner/brand-spinner";

export default function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <BrandSpinner size={64} label="Loading…" />
    </div>
  );
}
