"use client";

import { useState } from "react";
import type { FulfillmentRow } from "@/lib/queries/fulfillment";
import { WarehouseCard } from "./warehouse-card";
import { StatusToastStack, type ToastData } from "@/components/system/status-toast";

export type WarehouseToast = ToastData;

type Props = {
  rows: FulfillmentRow[];
  isReadOnly: boolean;
  selfName?: string;
  selfInitials?: string;
  isAdmin?: boolean;
};

export function WarehouseGrid({ rows, isReadOnly, selfName, selfInitials, isAdmin }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast     = (t: ToastData) => setToasts((prev) => [...prev, t]);
  const dismissToast = (id: string)   => setToasts((prev) => prev.filter((t) => t.id !== id));

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
          <WarehouseCard
            key={row.id}
            row={row}
            isReadOnly={isReadOnly}
            isSelected={selectedId === row.id}
            onSelect={() => setSelectedId(row.id)}
            onDeselect={() => setSelectedId(null)}
            onToast={addToast}
            selfName={selfName}
            selfInitials={selfInitials}
            isAdmin={isAdmin}
          />
        ))}
      </div>

      <StatusToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
