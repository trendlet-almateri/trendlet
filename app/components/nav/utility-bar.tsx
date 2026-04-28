import { SearchTrigger } from "@/components/nav/search-trigger";

type UtilityBarProps = {
  notifications?: React.ReactNode;
};

/**
 * Top-right of every authenticated page.
 * SearchTrigger opens the command palette (mounted once in the app shell).
 * The bell trigger is provided by NotificationsPanel and slotted in via props.
 */
export function UtilityBar({ notifications }: UtilityBarProps) {
  return (
    <div className="hidden items-center gap-2 md:flex">
      <SearchTrigger />

      {notifications}

      <div
        className="flex h-9 items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 text-[12px]"
        aria-label="Display language"
      >
        <span className="font-medium text-ink-primary">EN</span>
        <span className="text-ink-tertiary">|</span>
        <span className="text-ink-tertiary" lang="ar">عربي</span>
      </div>
    </div>
  );
}
