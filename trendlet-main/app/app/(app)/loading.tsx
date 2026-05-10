import { BrandSpinner } from "@/components/spinner/brand-spinner";

export default function AppLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <BrandSpinner size={64} label="Loading…" />
    </div>
  );
}
