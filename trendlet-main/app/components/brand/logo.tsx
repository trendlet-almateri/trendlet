import { cn } from "@/lib/utils";

type LogoProps = {
  subtitle?: string;
  className?: string;
  size?: "sm" | "md";
};

export function Logo({ subtitle = "Operations Console", className, size = "md" }: LogoProps) {
  const square = size === "sm" ? "h-7 w-7 text-[13px]" : "h-8 w-8 text-[14px]";
  const title = size === "sm" ? "text-[13px]" : "text-[14px]";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "grid place-items-center rounded-md bg-accent font-medium text-white",
          square,
        )}
        aria-hidden
      >
        T
      </span>
      <span className="flex flex-col leading-tight">
        <span className={cn("font-medium text-ink-primary", title)}>Trendslet</span>
        <span className="text-[11px] text-ink-tertiary">{subtitle}</span>
      </span>
    </div>
  );
}
