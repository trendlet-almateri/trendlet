import { requireRole } from "@/lib/auth/require-role";
import {
  Card,
  Column,
  DataTable,
  FilterBar,
  FilterSelect,
  FilterSubmit,
  PageHeader,
  StatCard,
  StatusChip,
  TabPills,
  TopBar,
  UrgencyBadge,
} from "@/components/system";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Design system · Trendslet Operations",
};

type DemoOrder = {
  id: string;
  product: string;
  brand: string;
  customer: string;
  region: "US" | "EU" | "UK" | "KSA";
  stage: string;
  total: string;
};

/**
 * Locked design system reference. Every primitive renders here
 * against the screenshot spec so /queue, /pipeline, /dashboard etc.
 * have a single source of truth to copy.
 *
 * Admin-only. Once the system rolls out to real pages, this stays
 * as the living style guide.
 */
export default async function DesignSystemPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  await requireRole(["admin"]);
  const activeTab = searchParams?.tab ?? "todo";

  return (
    <div className="flex flex-col gap-12 pb-12">
      <PageHeader
        title="Design system"
        subtitle="Locked spec for every primitive. Use these components instead of inlining styles."
      />

      <Section title="1 · TopBar">
        <TopBar title="Sourcing" hasUnread />
      </Section>

      <Section title="2 · PageHeader">
        <Card>
          <PageHeader
            title="My sourcing tasks"
            subtitle="US brands · 12 active sub-orders"
          />
        </Card>
      </Section>

      <Section title="3 · StatCard">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="Total orders"
            value="1,284"
            trend={{ direction: "up", text: "8.2%" }}
          />
          <StatCard label="Active" value="923" caption="across 7 stages" />
          <StatCard
            label="Delayed"
            value="351"
            caption={<span className="text-rose-600">9 at risk</span>}
          />
          <StatCard label="Completed" value="215" caption="94.6% on-time" />
          <StatCard
            label="Gross processed"
            value="SAR 4.53M"
            trend={{ direction: "up", text: "14% vs prev" }}
            variant="accent"
          />
        </div>
      </Section>

      <Section title="4 · StatusChip">
        <Card>
          <div className="flex flex-wrap gap-2">
            <StatusChip status="pending" />
            <StatusChip status="in_progress" label="In progress" />
            <StatusChip status="purchased_in_store" label="Purchased (in-store)" />
            <StatusChip status="purchased_online" label="Purchased (online)" />
            <StatusChip status="out_of_stock" label="Out of stock" />
            <StatusChip status="delivered_to_warehouse" label="Delivered to warehouse" />
            <StatusChip status="warehouse" label="Warehouse" />
            <StatusChip status="shipping" label="Shipping" />
            <StatusChip status="shipped" label="Shipped" />
            <StatusChip status="arrived_in_ksa" label="Arrived in KSA" />
            <StatusChip status="out_for_delivery" label="Out for delivery" />
            <StatusChip status="delivered" label="Delivered" />
            <StatusChip status="returned" label="Returned" />
            <StatusChip status="cancelled" label="Cancelled" />
            <StatusChip status="delayed" label="Delayed" />
          </div>
        </Card>
      </Section>

      <Section title="5 · UrgencyBadge">
        <Card>
          <div className="flex items-center gap-3">
            <UrgencyBadge urgent />
            <UrgencyBadge urgent={false} />
          </div>
        </Card>
      </Section>

      <Section title="6 · TabPills">
        <Card>
          <TabPills
            activeKey={activeTab}
            tabs={[
              { key: "todo", label: "To do", count: 30, dotColor: "bg-amber-400" },
              { key: "in_progress", label: "In progress", count: 19, dotColor: "bg-sky-500" },
              { key: "completed", label: "Completed", count: 31, dotColor: "bg-emerald-500" },
            ]}
            hrefFor={(k) => `/system?tab=${k}`}
          />
        </Card>
      </Section>

      <Section title="7 · FilterBar">
        <Card>
          <FilterBar
            action="/system"
            hidden={{ tab: activeTab }}
            right={
              <>
                <FilterSelect name="sort" defaultValue="urgent">
                  <option value="urgent">Sort: Urgent first</option>
                  <option value="newest">Sort: Newest first</option>
                </FilterSelect>
                <FilterSubmit />
              </>
            }
          >
            <FilterSelect name="priority" defaultValue="all">
              <option value="all">All priorities</option>
            </FilterSelect>
            <FilterSelect name="region" defaultValue="all">
              <option value="all">All regions</option>
            </FilterSelect>
            <FilterSelect name="brand" defaultValue="all">
              <option value="all">All brands</option>
            </FilterSelect>
          </FilterBar>
        </Card>
      </Section>

      <Section title="8 · Card (sourcing-style)">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card interactive accent="danger">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UrgencyBadge urgent />
                <span className="text-[12px] font-medium text-ink-tertiary tabular-nums">
                  ORD-48154
                </span>
              </div>
              <StatusChip status="in_progress" label="In progress" />
            </div>
            <h3 className="mt-3 text-[15px] font-semibold leading-tight tracking-[-0.01em] text-ink-primary">
              Glass Carafe — Amber
            </h3>
            <p className="mt-1 text-[12px] text-ink-tertiary">
              Mesa · Noah B. · KSA
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3 text-[12px] text-ink-tertiary">
              <span>changed 15d ago</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-md border border-status-danger-border/40 bg-surface px-3 py-1.5 text-[12px] font-medium text-status-danger-fg hover:bg-status-danger-bg/50"
                >
                  Cancel order
                </button>
                <button
                  type="button"
                  className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white shadow-sm hover:bg-navy-deep"
                >
                  Start review
                </button>
              </div>
            </div>
          </Card>
          <Card interactive>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UrgencyBadge urgent={false} />
                <span className="text-[12px] font-medium text-ink-tertiary tabular-nums">
                  ORD-48095
                </span>
              </div>
              <StatusChip status="purchased_in_store" label="Purchased (in-store)" />
            </div>
            <h3 className="mt-3 text-[15px] font-semibold leading-tight tracking-[-0.01em] text-ink-primary">
              Cold-press Juicer
            </h3>
            <p className="mt-1 text-[12px] text-ink-tertiary">
              Trail Run · Hiro T. · UK
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3 text-[12px] text-ink-tertiary">
              <span>changed 5d ago</span>
              <button
                type="button"
                className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white shadow-sm hover:bg-navy-deep"
              >
                Hand off
              </button>
            </div>
          </Card>
        </div>
      </Section>

      <Section title="9 · DataTable (Orders-style)">
        <DataTable<DemoOrder>
          selectable
          columns={ORDER_COLUMNS}
          rows={DEMO_ROWS}
          rowKey={(r) => r.id}
          rowHref={(r) => `/orders/${r.id}`}
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.6px] text-ink-tertiary">
        {title}
      </h2>
      {children}
    </section>
  );
}

const ORDER_COLUMNS: Column<DemoOrder>[] = [
  { key: "id",       header: "Order",    cell: (r) => <span className="font-medium tabular-nums">{r.id}</span> },
  { key: "product",  header: "Product",  cell: (r) => r.product },
  { key: "brand",    header: "Brand",    cell: (r) => r.brand },
  { key: "customer", header: "Customer", cell: (r) => r.customer },
  { key: "region",   header: "Region",   cell: (r) => r.region },
  { key: "stage",    header: "Stage",    cell: (r) => <StatusChip status={r.stage} /> },
  { key: "total",    header: "Total",    align: "right", cell: (r) => r.total },
];

const DEMO_ROWS: DemoOrder[] = [
  { id: "ORD-48210", product: "Beanie",                brand: "Mesa",       customer: "Marco R.", region: "UK",  stage: "delivered", total: "EUR 2,153.94" },
  { id: "ORD-48209", product: "Glass Carafe — Amber",  brand: "Walnut & Co",customer: "Elena V.", region: "UK",  stage: "shipping",  total: "USD 175.06" },
  { id: "ORD-48208", product: "Linen Crew Tee",        brand: "Trail Run",  customer: "Aoife K.", region: "US",  stage: "delayed",   total: "AED 708.32" },
  { id: "ORD-48207", product: "Trouser",               brand: "Halcyon",    customer: "Kori Y.",  region: "KSA", stage: "shipping",  total: "AED 2,242.26" },
  { id: "ORD-48206", product: "Glass Carafe — Amber",  brand: "Walnut & Co",customer: "Layla H.", region: "US",  stage: "shipping",  total: "AED 1,825.70" },
  { id: "ORD-48205", product: "Throw Blanket",         brand: "Trail Run",  customer: "Priya S.", region: "KSA", stage: "delayed",   total: "AED 1,512.38" },
  { id: "ORD-48204", product: "Structured Tote",       brand: "Sable",      customer: "Ines L.",  region: "EU",  stage: "warehouse", total: "AED 1,888.86" },
];
