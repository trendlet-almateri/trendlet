import Link from "next/link";
import { cn } from "@/lib/utils";

type Tab = {
  key: string;
  label: string;
  count?: number | null;
};

type FilterTabsProps = {
  tabs: Tab[];
  active: string;
  basePath: string;
};

export function FilterTabs({ tabs, active, basePath }: FilterTabsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-hairline">
      {tabs.map((t) => {
        const isActive = t.key === active;
        const href = t.key === "all" ? basePath : `${basePath}?filter=${t.key}`;
        return (
          <Link
            key={t.key}
            href={href}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] transition-colors",
              isActive
                ? "border-navy text-ink-primary"
                : "border-transparent text-ink-secondary hover:text-ink-primary",
            )}
          >
            <span>{t.label}</span>
            {typeof t.count === "number" && (
              <span
                className={cn(
                  "rounded-sm px-1.5 py-0.5 text-[11px] tabular-nums",
                  isActive ? "bg-neutral-100 text-ink-primary" : "bg-neutral-100 text-ink-tertiary",
                )}
              >
                {t.count.toLocaleString("en-US")}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
