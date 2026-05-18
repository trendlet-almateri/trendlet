/**
 * Read-only order queries + normalization for the AI Support layer.
 *
 * Every function here uses the service-role client (server-only) and runs
 * SELECT only. The returned DTOs are deliberately minimal: NO internal
 * UUIDs, NO assigned_employee/status_changed_by, NO admin notes/metadata,
 * NO internal shipment IDs, NO raw schema. Status keys are kept only
 * inside a `status` object alongside human labels (the AI is instructed
 * to show labels, not keys, to customers).
 */

import { createServiceClient } from "@/lib/supabase/server";

// ── DTOs (the safe public shape) ─────────────────────────────────────────────
export type StatusDTO = {
  key: string;
  label_en: string;
  label_ar: string;
  isTerminal: boolean;
};

export type TrackingDTO = {
  trackingNumber: string | null;
  shipmentStatus: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
};

export type SubOrderDTO = {
  subOrderNumber: string;
  productTitle: string;
  quantity: number;
  status: StatusDTO;
  statusChangedAt: string;
  tracking: TrackingDTO | null;
};

export type OrderDetailsDTO = {
  found: true;
  orderNumber: string;
  financialStatus: string | null;
  customer: { name: string | null; email: string | null } | null;
  subOrders: SubOrderDTO[];
  summary: { subOrderCount: number; mixedStatuses: boolean };
};

export type OrderSearchResultDTO = {
  orderNumber: string;
  placedAt: string | null;
  subOrderCount: number;
  statusSummary: string; // e.g. "2 Shipped, 1 Cancelled"
};

// ── Status lookup (cached per request via a simple map) ──────────────────────
type StatusRow = { key: string; label_en: string; label_ar: string; is_terminal: boolean };

async function loadStatusMap(
  sb: ReturnType<typeof createServiceClient>,
): Promise<Map<string, StatusDTO>> {
  const { data } = await sb
    .from("statuses")
    .select("key, label_en, label_ar, is_terminal");
  const map = new Map<string, StatusDTO>();
  for (const r of (data ?? []) as StatusRow[]) {
    map.set(r.key, {
      key: r.key,
      label_en: r.label_en,
      label_ar: r.label_ar,
      isTerminal: r.is_terminal,
    });
  }
  return map;
}

function statusDTO(map: Map<string, StatusDTO>, key: string): StatusDTO {
  return (
    map.get(key) ?? { key, label_en: key, label_ar: key, isTerminal: false }
  );
}

// ── getOrderDetails ──────────────────────────────────────────────────────────
type SubOrderRow = {
  id: string;
  sub_order_number: string;
  product_title: string;
  quantity: number;
  status: string;
  status_changed_at: string;
};

export async function getOrderDetails(
  orderNumber: string,
): Promise<OrderDetailsDTO | null> {
  const sb = createServiceClient();

  const { data: orderRaw } = await sb
    .from("orders")
    .select(
      `id, shopify_order_number, financial_status,
       customer:customers ( first_name, last_name, email )`,
    )
    .eq("shopify_order_number", orderNumber)
    .maybeSingle();

  if (!orderRaw) return null;

  // The generated Database type is stale (missing financial_status — known
  // schema drift). The runtime row IS correct (verified live); cast through
  // unknown to the real shape.
  const order = orderRaw as unknown as {
    id: string;
    shopify_order_number: string;
    financial_status: string | null;
    customer: {
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    } | null;
  };

  const [{ data: subRows }, statusMap] = await Promise.all([
    sb
      .from("sub_orders")
      .select("id, sub_order_number, product_title, quantity, status, status_changed_at")
      .eq("order_id", order.id)
      .order("sub_order_number", { ascending: true }),
    loadStatusMap(sb),
  ]);

  const subs = (subRows ?? []) as SubOrderRow[];

  // Tracking per sub-order (junction → shipments). One round-trip.
  const trackingBySub = await loadTracking(
    sb,
    subs.map((s) => s.id),
  );

  const customerRel = order.customer;
  const customer = customerRel
    ? {
        name:
          [customerRel.first_name, customerRel.last_name]
            .filter(Boolean)
            .join(" ") || null,
        email: customerRel.email ?? null,
      }
    : null;

  const subOrders: SubOrderDTO[] = subs.map((s) => ({
    subOrderNumber: s.sub_order_number,
    productTitle: s.product_title,
    quantity: s.quantity,
    status: statusDTO(statusMap, s.status),
    statusChangedAt: s.status_changed_at,
    tracking: trackingBySub.get(s.id) ?? null,
  }));

  const distinct = new Set(subOrders.map((s) => s.status.key));

  return {
    found: true,
    orderNumber: order.shopify_order_number,
    financialStatus: order.financial_status ?? null,
    customer,
    subOrders,
    summary: {
      subOrderCount: subOrders.length,
      mixedStatuses: distinct.size > 1,
    },
  };
}

// ── Tracking (shared by getOrderDetails + getShipmentTracking) ───────────────
type ShipmentLinkRow = {
  sub_order_id: string;
  shipment: {
    tracking_number: string | null;
    status: string;
    shipped_at: string | null;
    delivered_at: string | null;
  } | null;
};

async function loadTracking(
  sb: ReturnType<typeof createServiceClient>,
  subOrderIds: string[],
): Promise<Map<string, TrackingDTO>> {
  const map = new Map<string, TrackingDTO>();
  if (subOrderIds.length === 0) return map;

  const { data } = await sb
    .from("shipment_sub_orders")
    .select(
      `sub_order_id,
       shipment:shipments ( tracking_number, status, shipped_at, delivered_at )`,
    )
    .in("sub_order_id", subOrderIds);

  for (const row of (data ?? []) as ShipmentLinkRow[]) {
    if (!row.shipment) continue;
    map.set(row.sub_order_id, {
      trackingNumber: row.shipment.tracking_number,
      shipmentStatus: row.shipment.status,
      shippedAt: row.shipment.shipped_at,
      deliveredAt: row.shipment.delivered_at,
    });
  }
  return map;
}

export type ShipmentTrackingDTO = {
  found: true;
  orderNumber: string;
  shipments: {
    subOrderNumbers: string[];
    trackingNumber: string | null;
    shipmentStatus: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
  }[];
};

export async function getShipmentTracking(
  orderNumber: string,
): Promise<ShipmentTrackingDTO | null> {
  const sb = createServiceClient();

  const { data: orderRaw } = await sb
    .from("orders")
    .select("id, shopify_order_number")
    .eq("shopify_order_number", orderNumber)
    .maybeSingle();

  if (!orderRaw) return null;
  const order = orderRaw as unknown as {
    id: string;
    shopify_order_number: string;
  };

  const { data: subRows } = await sb
    .from("sub_orders")
    .select("id, sub_order_number")
    .eq("order_id", order.id);

  const subs = (subRows ?? []) as { id: string; sub_order_number: string }[];
  if (subs.length === 0) {
    return {
      found: true,
      orderNumber: order.shopify_order_number,
      shipments: [],
    };
  }

  const idToNumber = new Map(subs.map((s) => [s.id, s.sub_order_number]));

  const { data: links } = await sb
    .from("shipment_sub_orders")
    .select(
      `sub_order_id,
       shipment:shipments ( tracking_number, status, shipped_at, delivered_at )`,
    )
    .in(
      "sub_order_id",
      subs.map((s) => s.id),
    );

  // Group sub-orders by their shipment (one shipment can cover several).
  type Agg = {
    subOrderNumbers: string[];
    trackingNumber: string | null;
    shipmentStatus: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
  };
  const byTracking = new Map<string, Agg>();

  for (const row of (links ?? []) as ShipmentLinkRow[]) {
    if (!row.shipment) continue;
    const key =
      row.shipment.tracking_number ??
      `__notrack__${row.shipment.status}_${row.shipment.shipped_at ?? ""}`;
    const num = idToNumber.get(row.sub_order_id);
    const existing = byTracking.get(key);
    if (existing) {
      if (num) existing.subOrderNumbers.push(num);
    } else {
      byTracking.set(key, {
        subOrderNumbers: num ? [num] : [],
        trackingNumber: row.shipment.tracking_number,
        shipmentStatus: row.shipment.status,
        shippedAt: row.shipment.shipped_at,
        deliveredAt: row.shipment.delivered_at,
      });
    }
  }

  return {
    found: true,
    orderNumber: order.shopify_order_number,
    shipments: Array.from(byTracking.values()),
  };
}

// ── searchOrdersByEmail ──────────────────────────────────────────────────────
const SEARCH_LIMIT = 20;

export async function searchOrdersByEmail(
  email: string,
): Promise<OrderSearchResultDTO[]> {
  const sb = createServiceClient();

  // email is citext → equality is case-insensitive at the DB level.
  const { data: customers } = await sb
    .from("customers")
    .select("id")
    .eq("email", email)
    .limit(5);

  const customerIds = (customers ?? []).map((c) => (c as { id: string }).id);
  if (customerIds.length === 0) return [];

  const { data: orders } = await sb
    .from("orders")
    .select(
      `shopify_order_number, shopify_created_at,
       sub_orders ( status )`,
    )
    .in("customer_id", customerIds)
    .order("shopify_created_at", { ascending: false })
    .limit(SEARCH_LIMIT);

  const statusMap = await loadStatusMap(sb);

  return ((orders ?? []) as {
    shopify_order_number: string;
    shopify_created_at: string | null;
    sub_orders: { status: string }[];
  }[]).map((o) => {
    const counts = new Map<string, number>();
    for (const so of o.sub_orders ?? []) {
      counts.set(so.status, (counts.get(so.status) ?? 0) + 1);
    }
    const summary =
      Array.from(counts.entries())
        .map(([k, n]) => `${n} ${statusDTO(statusMap, k).label_en}`)
        .join(", ") || "No items";
    return {
      orderNumber: o.shopify_order_number,
      placedAt: o.shopify_created_at,
      subOrderCount: (o.sub_orders ?? []).length,
      statusSummary: summary,
    };
  });
}
