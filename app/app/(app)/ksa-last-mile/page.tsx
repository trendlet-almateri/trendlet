import { MapPin } from "lucide-react";

export const metadata = { title: "KSA Last-Mile · Trendslet Operations" };

export default function KsaLastMilePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-32">
      <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
        <MapPin className="h-6 w-6 text-[var(--muted)]" strokeWidth={1.5} />
      </span>
      <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
        KSA last-mile
      </p>
    </div>
  );
}
