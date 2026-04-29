import { BrandSpinner } from "@/components/brand/brand-spinner";

export default function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page">
      <BrandSpinner size={56} />
    </div>
  );
}
