"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FulfillmentRow } from "@/lib/queries/fulfillment";
import { EuCard, type EuToast } from "./eu-card";

type Props = {
  rows: FulfillmentRow[];
  isReadOnly: boolean;
  selfName?: string;
  selfInitials?: string;
};

export function EuGrid({ rows, isReadOnly, selfName, selfInitials }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<EuToast[]>([]);

  const addToast = (t: EuToast) => {
    setToasts((prev) => [...prev.slice(-2), t]);
  };

  useEffect(() => {
    if (toasts.length === 0) return;
    const id = setTimeout(() => setToasts((prev) => prev.slice(1)), 4000);
    return () => clearTimeout(id);
  }, [toasts]);

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
          <EuCard
            key={row.id}
            row={row}
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

      {toasts.length > 0 && (
        <div className="fixed bottom-16 right-6 z-50 flex flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={cn(
                "flex min-w-[260px] max-w-[340px] items-start gap-3 rounded-xl border px-4 py-3 shadow-[var(--shadow-md)]",
                t.kind === "success"
                  ? "border-green-200 bg-white"
                  : "border-[var(--line)] bg-[var(--ink)] text-white",
              )}
            >
              {t.kind === "success" && (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
              )}
              <div className="flex-1">
                <p className={cn(
                  "text-[13px] font-semibold",
                  t.kind === "success" ? "text-[var(--ink)]" : "text-white",
                )}>
                  {t.message}
                </p>
                {t.sub && (
                  <p className="mt-0.5 text-[11px] text-[var(--muted)]">{t.sub}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="mt-0.5 text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
