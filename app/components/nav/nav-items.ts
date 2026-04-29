import {
  LayoutDashboard,
  Package,
  Receipt,
  Truck,
  CornerDownLeft,
  ShoppingBag,
  Warehouse,
  Globe,
  MapPin,
  Activity,
  Users,
  Wallet,
  BarChart3,
  Tag,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/types/database";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Tailwind bg class for the colored dot (Operations group only) */
  dot?: string;
  /** Roles that should see this item. Empty = everyone. */
  roles?: Role[];
};

export type NavSection = {
  id: "workspace" | "operations" | "insights";
  label: string;
  items: NavItem[];
};

/**
 * Source of truth for sidebar + bottom-nav navigation.
 * Counts are loaded separately in the layout (server-side).
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin"] },
      { href: "/orders", label: "Orders", icon: Package, roles: ["admin"] },
      { href: "/invoices", label: "Invoices", icon: Receipt, roles: ["admin"] },
      { href: "/shipments", label: "Shipments", icon: Truck, roles: ["admin"] },
      { href: "/returns", label: "Returns", icon: CornerDownLeft, roles: ["admin"] },
      { href: "/admin/brands", label: "Brands", icon: Tag, roles: ["admin"] },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { href: "/queue", label: "Sourcing", icon: ShoppingBag, dot: "bg-status-sourcing-border", roles: ["sourcing", "fulfiller", "admin"] },
      { href: "/pipeline", label: "Warehouse", icon: Warehouse, dot: "bg-status-warehouse-border", roles: ["warehouse", "fulfiller", "admin"] },
      { href: "/fulfillment", label: "EU fulfillment", icon: Globe, dot: "bg-status-transit-border", roles: ["fulfiller", "admin"] },
      { href: "/deliveries", label: "KSA last-mile", icon: MapPin, dot: "bg-status-delivered-border", roles: ["ksa_operator", "admin"] },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    items: [
      { href: "/sla-health", label: "SLA health", icon: Activity, roles: ["admin"] },
      { href: "/team-load", label: "Team load", icon: Users, roles: ["admin"] },
      { href: "/payroll", label: "Payroll", icon: Wallet, roles: ["admin"] },
      { href: "/reports", label: "Reports", icon: BarChart3, roles: ["admin"] },
    ],
  },
];

export function visibleSections(roles: Role[]): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => !item.roles || item.roles.some((r) => roles.includes(r)),
    ),
  })).filter((section) => section.items.length > 0);
}
