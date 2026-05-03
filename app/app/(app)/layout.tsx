import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { Sidebar } from "@/components/nav/sidebar";
import { BottomNav } from "@/components/nav/bottom-nav";
import { MobileTopbar } from "@/components/nav/mobile-topbar";
import { NotificationsPanel } from "@/components/notifications/notifications-panel";
import { CommandPalette } from "@/components/nav/command-palette";
import { ServiceWorkerRegister } from "@/components/offline/sw-register";
import { fetchRecentNotifications } from "@/lib/queries/notifications";
import { MobileNavProvider } from "@/components/nav/mobile-nav-context";

export const dynamic = "force-dynamic";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

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

/**
 * Authenticated app shell. getCurrentUser() is the only blocking await here —
 * notifications stream in via Suspense so the sidebar renders immediately and
 * the (app)/loading.tsx spinner is visible while page data loads.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const counts: Record<string, number | null> = {};
  const unassignedCount = 0;

  return (
    <MobileNavProvider>
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <Sidebar
        user={{
          fullName: user.fullName ?? user.email,
          email: user.email,
          roles: user.roles,
        }}
        counts={counts}
        unassignedCount={unassignedCount}
        notifications={
          <Suspense fallback={null}>
            <NotificationsData userId={user.id} channelKey="desktop" />
          </Suspense>
        }
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <MobileTopbar
          notifications={
            <Suspense fallback={null}>
              <NotificationsData userId={user.id} channelKey="mobile" />
            </Suspense>
          }
        />
        <main className="flex-1 px-4 pb-20 pt-4 md:px-6 md:pb-6">{children}</main>
      </div>

      <BottomNav
        roles={user.roles}
        fullName={user.fullName ?? user.email}
        email={user.email}
        primaryRole={user.roles[0] ?? "user"}
        initials={getInitials(user.fullName ?? user.email)}
        unassignedCount={unassignedCount}
      />
      <CommandPalette />
      <ServiceWorkerRegister />
    </div>
    </MobileNavProvider>
  );
}
