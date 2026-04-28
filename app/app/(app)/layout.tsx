import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { Sidebar } from "@/components/nav/sidebar";
import { BottomNav } from "@/components/nav/bottom-nav";
import { MobileTopbar } from "@/components/nav/mobile-topbar";
import { NotificationsPanel } from "@/components/notifications/notifications-panel";
import { CommandPalette } from "@/components/nav/command-palette";
import { ServiceWorkerRegister } from "@/components/offline/sw-register";
import { fetchRecentNotifications } from "@/lib/queries/notifications";

export const dynamic = "force-dynamic";

/**
 * Authenticated app shell. Renders for all routes that require sign-in:
 *   /dashboard, /orders, /queue, /pipeline, /deliveries, ...
 *
 * Sidebar counts are still stub-zero — wired to real queries when sub-order
 * counts move into a shared layout query (Phase 6+).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const counts: Record<string, number | null> = {};
  const unassignedCount = 0;

  const initialNotifications = await fetchRecentNotifications();
  const desktopNotifications = (
    <NotificationsPanel
      initialNotifications={initialNotifications}
      userId={user.id}
      channelKey="desktop"
    />
  );
  const mobileNotifications = (
    <NotificationsPanel
      initialNotifications={initialNotifications}
      userId={user.id}
      channelKey="mobile"
    />
  );

  return (
    <div className="flex h-screen overflow-hidden bg-page">
      <Sidebar
        user={{
          fullName: user.fullName ?? user.email,
          email: user.email,
          roles: user.roles,
        }}
        counts={counts}
        unassignedCount={unassignedCount}
        notifications={desktopNotifications}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <MobileTopbar notifications={mobileNotifications} />
        <main className="flex-1 px-4 pb-20 pt-4 md:px-6 md:pb-6">{children}</main>
      </div>

      <BottomNav />
      <CommandPalette />
      <ServiceWorkerRegister />
    </div>
  );
}
