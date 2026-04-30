import { Bell, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Desktop top bar matching the screenshot spec:
 * - Page-title slot on the left (optional)
 * - ⌘K search field in the middle / right
 * - Notification bell with optional unread dot
 * - Language toggle (EN | عربي)
 *
 * Pure presentation. Search and language toggle are non-functional
 * placeholders here — wire them up at the layout level when this
 * component is mounted into the app shell.
 */
export function TopBar({
  title,
  hasUnread = false,
  className,
}: {
  title?: React.ReactNode;
  hasUnread?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex h-14 items-center justify-between gap-4 border-b border-hairline bg-surface px-4 md:px-6",
        className,
      )}
    >
      <div className="flex min-w-0 items-center">
        {title && (
          <h1 className="truncate text-[15px] font-semibold text-ink-primary">
            {title}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <SearchField />
        <NotificationButton hasUnread={hasUnread} />
        <LangToggle />
      </div>
    </header>
  );
}

function SearchField() {
  return (
    <label className="hidden items-center gap-2 rounded-md border border-hairline bg-page px-3 py-1.5 text-[13px] text-ink-tertiary transition-colors focus-within:border-accent/40 focus-within:bg-surface md:flex md:w-[300px] lg:w-[360px]">
      <Search className="h-3.5 w-3.5" aria-hidden />
      <input
        type="search"
        placeholder="Search"
        className="w-full bg-transparent placeholder:text-ink-tertiary focus:outline-none"
        aria-label="Search"
      />
      <kbd className="ml-auto inline-flex h-5 items-center rounded border border-hairline bg-surface px-1.5 text-[10px] font-medium text-ink-tertiary">
        ⌘K
      </kbd>
    </label>
  );
}

function NotificationButton({ hasUnread }: { hasUnread: boolean }) {
  return (
    <button
      type="button"
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-hairline bg-surface text-ink-secondary transition-colors hover:bg-hover"
      aria-label={hasUnread ? "Notifications (unread)" : "Notifications"}
    >
      <Bell className="h-4 w-4" aria-hidden />
      {hasUnread && (
        <span
          className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose"
          aria-hidden
        />
      )}
    </button>
  );
}

function LangToggle() {
  return (
    <div
      className="flex h-9 items-center rounded-md border border-hairline bg-surface px-2 text-[12px]"
      aria-label="Language toggle"
    >
      <span className="font-medium text-ink-primary">EN</span>
      <span className="mx-1.5 text-ink-tertiary">|</span>
      <span className="text-ink-tertiary" lang="ar">عربي</span>
    </div>
  );
}
