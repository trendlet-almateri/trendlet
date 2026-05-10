"use client";

import { useState } from "react";
import type { FulfillmentRow } from "@/lib/queries/fulfillment";
import type { Role } from "@/lib/workflow/sub-order-transitions";
import { SourcingCard } from "./sourcing-card";
import { StatusToastStack, type ToastData } from "@/components/system/status-toast";

// Re-export so sourcing-card.tsx can keep its existing onToast prop type name.
export type SourcingToast = ToastData;

type Props = {
  rows: FulfillmentRow[];
  role: Role;
  isReadOnly: boolean;
  selfName?: string;
  selfInitials?: string;
};

export function SourcingGrid({ rows, role, isReadOnly, selfName, selfInitials }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast    = (t: ToastData) => setToasts((prev) => [...prev, t]);
  const dismissToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--line)] bg-[var(--hover)] py-16 text-center">
        <p className="text-[13px] font-medium text-[var(--ink)]">Nothing here</p>
        <p className="text-[12px] text-[var(--muted)]">No tasks match this view.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <SourcingCard
            key={row.id}
            row={row}
            role={role}
            isReadOnly={isReadOnly}
            isSelected={selectedId === row.id}
            onSelect={() => setSelectedId(row.id)}
            onDeselect={() => setSelectedId(null)}
            onToast={addToast}
            selfName={selfName}
            selfInitials={selfInitials}
          />
        ))}
      </div>

      <StatusToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
