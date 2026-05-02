// Status definitions — full list of 15 from §6 / §7 of the system prompt.
// Extra metadata (label, palette, customer-notify flag) is duplicated in the
// `statuses` table seed so the DB and UI stay aligned.

export const STATUSES = [
  { code: "pending", label: "Pending", palette: "pending", stage: "pending" },
  { code: "assigned", label: "Assigned", palette: "pending", stage: "pending" },
  { code: "unassigned", label: "Unassigned", palette: "danger", stage: "pending" },
  { code: "under_review", label: "Under review", palette: "sourcing", stage: "sourcing" },
  { code: "in_progress", label: "In progress", palette: "sourcing", stage: "sourcing" },
  { code: "purchased_online", label: "Purchased (online)", palette: "sourcing", stage: "sourcing" },
  { code: "purchased_in_store", label: "Purchased (in-store)", palette: "sourcing", stage: "sourcing" },
  { code: "out_of_stock", label: "Out of stock", palette: "danger", stage: "sourcing" },
  { code: "delivered_to_warehouse", label: "Delivered to warehouse", palette: "warehouse", stage: "warehouse" },
  { code: "preparing_for_shipment", label: "Preparing for shipment", palette: "warehouse", stage: "warehouse" },
  { code: "shipped", label: "Shipped", palette: "transit", stage: "shipping" },
  { code: "arrived_in_ksa", label: "Arrived in KSA", palette: "transit", stage: "shipping" },
  { code: "out_for_delivery", label: "Out for delivery", palette: "transit", stage: "shipping" },
  { code: "delivered", label: "Delivered", palette: "delivered", stage: "delivered" },
  { code: "returned", label: "Returned", palette: "danger", stage: "returned" },
  { code: "cancelled", label: "Cancelled", palette: "pending", stage: "cancelled" },
  { code: "failed", label: "Failed", palette: "danger", stage: "failed" },
] as const;

export type StatusCode = (typeof STATUSES)[number]["code"];
export type StatusPalette = (typeof STATUSES)[number]["palette"];

export const STATUS_BY_CODE: Record<string, (typeof STATUSES)[number]> = Object.fromEntries(
  STATUSES.map((s) => [s.code, s]),
);

// Per-role allowed transitions (admin bypasses). Mirrors the
// statuses.allowed_from_roles values in the DB; the DB trigger
// enforce_status_whitelist is the source of truth, this is only used
// to decide which buttons to render in the UI.
export const ROLE_STATUS_WHITELIST: Record<string, StatusCode[]> = {
  sourcing: [
    "in_progress", "purchased_online", "purchased_in_store",
    "out_of_stock", "delivered_to_warehouse",
  ],
  warehouse: ["delivered_to_warehouse", "shipped", "delivered"],
  fulfiller: [
    "in_progress", "purchased_online", "purchased_in_store", "out_of_stock",
    "delivered_to_warehouse", "shipped", "delivered",
  ],
  ksa_operator: ["arrived_in_ksa", "out_for_delivery", "delivered", "returned"],
};

export const ROLES = ["admin", "sourcing", "warehouse", "fulfiller", "ksa_operator"] as const;
