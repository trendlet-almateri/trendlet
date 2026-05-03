"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Search, Package, User, Box, Truck, Tag, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type SearchResult = {
  customers: { id: string; name: string; email: string; phone: string | null }[];
  orders: { id: string; number: string; customer_name: string }[];
  sub_orders: { id: string; number: string; product: string }[];
  shipments: { id: string; tracking_number: string; shipment_type: string }[];
  brands: { id: string; name: string }[];
  employees: { id: string; full_name: string; email: string }[];
};

const EMPTY: SearchResult = {
  customers: [],
  orders: [],
  sub_orders: [],
  shipments: [],
  brands: [],
  employees: [],
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult>(EMPTY);
  const [loading, setLoading] = React.useState(false);
  const supabaseRef = React.useRef<ReturnType<typeof createClient> | null>(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  // ⌘K / Ctrl+K toggle + custom event for click-triggered open
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("optify:open-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("optify:open-palette", onOpen);
    };
  }, []);

  // Debounced search
  React.useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(EMPTY);
      return;
    }

    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase.rpc("command_palette_search", {
        p_query: trimmed,
        p_limit: 5,
      });
      if (cancelled) return;
      setResults((data as SearchResult | null) ?? EMPTY);
      setLoading(false);
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, open, supabase]);

  // Reset query on close
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(EMPTY);
    }
  }, [open]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const totalResults =
    results.customers.length +
    results.orders.length +
    results.sub_orders.length +
    results.shipments.length +
    results.brands.length +
    results.employees.length;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className={cn(
        "fixed left-1/2 top-[20%] z-50 w-[540px] max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-md)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
      )}
      overlayClassName="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
    >
      <div className="flex items-center gap-2 border-b border-[var(--line)] px-4">
        <Search className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden />
        <Command.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder="Search orders, customers, products…"
          className="flex h-12 flex-1 bg-transparent text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
        />
        <kbd className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted)]">
          esc
        </kbd>
      </div>

      <Command.List className="max-h-[420px] overflow-y-auto p-2">
        {query.trim().length < 2 && (
          <div className="px-3 py-10 text-center text-[12px] text-[var(--muted)]">
            Type at least 2 characters to search.
          </div>
        )}

        {query.trim().length >= 2 && !loading && totalResults === 0 && (
          <Command.Empty className="px-3 py-10 text-center text-[12px] text-[var(--muted)]">
            No results for &ldquo;{query}&rdquo;.
          </Command.Empty>
        )}

        {results.orders.length > 0 && (
          <Group label="Orders">
            {results.orders.map((o) => (
              <Item
                key={o.id}
                icon={Package}
                onSelect={() => go(`/orders/${o.id}`)}
                primary={o.number}
                secondary={o.customer_name.trim() || "—"}
              />
            ))}
          </Group>
        )}

        {results.sub_orders.length > 0 && (
          <Group label="Sub-orders">
            {results.sub_orders.map((s) => (
              <Item
                key={s.id}
                icon={Box}
                onSelect={() => go(`/orders/unassigned`)}
                primary={s.number}
                secondary={s.product}
              />
            ))}
          </Group>
        )}

        {results.customers.length > 0 && (
          <Group label="Customers">
            {results.customers.map((c) => (
              <Item
                key={c.id}
                icon={User}
                onSelect={() => go(`/orders?customer=${c.id}`)}
                primary={c.name.trim() || c.email}
                secondary={c.email}
              />
            ))}
          </Group>
        )}

        {results.shipments.length > 0 && (
          <Group label="Shipments">
            {results.shipments.map((s) => (
              <Item
                key={s.id}
                icon={Truck}
                onSelect={() => go(`/shipments`)}
                primary={s.tracking_number}
                secondary={s.shipment_type}
              />
            ))}
          </Group>
        )}

        {results.brands.length > 0 && (
          <Group label="Brands">
            {results.brands.map((b) => (
              <Item
                key={b.id}
                icon={Tag}
                onSelect={() => go(`/orders?brand=${b.id}`)}
                primary={b.name}
              />
            ))}
          </Group>
        )}

        {results.employees.length > 0 && (
          <Group label="Team">
            {results.employees.map((e) => (
              <Item
                key={e.id}
                icon={Users}
                onSelect={() => go(`/team-load`)}
                primary={e.full_name}
                secondary={e.email}
              />
            ))}
          </Group>
        )}
      </Command.List>

      <div className="flex items-center justify-end gap-3 border-t border-[var(--line)] bg-[var(--hover)] px-4 py-2 text-[10px] text-[var(--muted)]">
        <span>↑↓ Navigate</span>
        <span>↵ Select</span>
        <span>⌘K Toggle</span>
      </div>
    </Command.Dialog>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Command.Group
      heading={label}
      className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-[var(--muted)]"
    >
      {children}
    </Command.Group>
  );
}

function Item({
  icon: Icon,
  primary,
  secondary,
  onSelect,
}: {
  icon: React.ComponentType<{ className?: string }>;
  primary: string;
  secondary?: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px]",
        "data-[selected=true]:bg-[var(--hover)]",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[var(--ink)]">{primary}</span>
      {secondary && (
        <span className="shrink-0 truncate text-[11px] text-[var(--muted)]">{secondary}</span>
      )}
    </Command.Item>
  );
}
