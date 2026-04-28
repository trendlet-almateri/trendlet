/**
 * Auth-shell skeleton: a single placeholder card matching the login layout.
 */
export default function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page">
      <div className="w-[380px] animate-pulse rounded-xl border border-hairline bg-surface p-10 shadow-login">
        <div className="mb-6 h-8 w-32 rounded-sm bg-neutral-200" />
        <div className="mb-2 h-4 w-44 rounded-sm bg-neutral-200" />
        <div className="mb-8 h-3 w-56 rounded-sm bg-neutral-200" />
        <div className="mb-4 h-9 w-full rounded-md bg-neutral-200" />
        <div className="mb-4 h-9 w-full rounded-md bg-neutral-200" />
        <div className="h-10 w-full rounded-md bg-neutral-200" />
      </div>
    </div>
  );
}
