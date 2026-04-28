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
    <div className="flex flex-wrap items-center gap-1.5">
      {tabs.map((t) => {
        const isActive = t.key === active;
        const href = t.key === "all" ? basePath : `${basePath}?filter=${t.key}`;
        return (
          <Link
            key={t.key}
            href={href}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              isActive
                ? "bg-ink-primary text-white"
                : "bg-transparent text-ink-secondary hover:bg-neutral-100 hover:text-ink-primary",
            )}
          >
            <span>{t.label}</span>
            {typeof t.count === "number" && (
              <span
                className={cn(
                  "tabular-nums text-[11px]",
                  isActive ? "text-white/70" : "text-ink-tertiary",
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
