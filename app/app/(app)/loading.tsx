/**
 * Skeleton shown during route transitions inside the authenticated app shell.
 * Mirrors the typical page layout: heading + 4 KPI tiles + a list block.
 * Hairline borders only — matches §3 design system (no shadows on cards).
 */
export default function AppLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="h-7 w-48 rounded-sm bg-neutral-200" />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex h-[88px] flex-col gap-2 rounded-md border border-hairline bg-surface p-4"
          >
            <div className="h-3 w-20 rounded-sm bg-neutral-200" />
            <div className="h-6 w-24 rounded-sm bg-neutral-200" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex h-14 items-center gap-3 rounded-md border border-hairline bg-surface px-4"
          >
            <div className="h-3 w-32 rounded-sm bg-neutral-200" />
            <div className="ml-auto h-3 w-20 rounded-sm bg-neutral-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
