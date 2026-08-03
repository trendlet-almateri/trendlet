import { MapPin } from "lucide-react";

export const metadata = { title: "KSA Last-Mile · Trendslet Operations" };

export default function KsaLastMilePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-32 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
        <MapPin className="h-6 w-6 text-[var(--muted)]" strokeWidth={1.5} />
      </span>
      <div className="flex flex-col items-center gap-2">
        <span className="rounded-full border border-[var(--line)] bg-[var(--hover)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          Coming soon
        </span>
        <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
          KSA last-mile
        </p>
        <p className="max-w-[320px] text-[13px] text-[var(--muted)]">
          The Saudi last-mile delivery queue isn&rsquo;t live yet. It&rsquo;ll open here once the shipping-company integration ships.
        </p>
      </div>
    </div>
  );
}
