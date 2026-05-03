import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { BottomNav } from "@/components/nav/bottom-nav";
import { MobileTopbar } from "@/components/nav/mobile-topbar";
import { NotificationsPanel } from "@/components/notifications/notifications-panel";
import { CommandPalette } from "@/components/nav/command-palette";
import { ServiceWorkerRegister } from "@/components/offline/sw-register";
import { fetchRecentNotifications } from "@/lib/queries/notifications";

export const dynamic = "force-dynamic";

async function NotificationsData({ userId, channelKey }: { userId: string; channelKey: string }) {
  const notifications = await fetchRecentNotifications();
  return (
    <NotificationsPanel
      initialNotifications={notifications}
      userId={userId}
      channelKey={channelKey}
    />
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const fullName = user.fullName ?? user.email;
  const initials = fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
  const primaryRole = user.roles[0] ?? "user";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg)]">
      {/* ── Top bar ── */}
      <MobileTopbar
        notifications={
          <Suspense fallback={null}>
            <NotificationsData userId={user.id} channelKey="topbar" />
          </Suspense>
        }
      />

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-5 md:px-8">
        {children}
      </main>

      {/* ── Bottom nav ── */}
      <BottomNav
        user={{
          fullName,
          email: user.email,
          roles: user.roles,
          initials,
          primaryRole,
          unassignedCount: 0,
        }}
      />

      <CommandPalette />
      <ServiceWorkerRegister />
    </div>
  );
}
