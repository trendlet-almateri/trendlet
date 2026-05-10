"use client";

import { AlertTriangle, X } from "lucide-react";
import { STATUS_BY_CODE, type StatusCode } from "@/lib/constants";
import {
  TWILIO_STATUS_TEMPLATES,
  isCustomerNotifyStatus,
  renderTemplateBody,
} from "@/lib/integrations/twilio-templates";
import { normalizeSaudiPhone } from "@/lib/utils/phone";

/**
 * Confirmation modal shown before any sub-order status change. Mirrors
 * the exact Arabic body the customer will receive (read from the
 * Twilio-approved templates) so the operator can catch wrong-row /
 * wrong-status mistakes before a WhatsApp goes out.
 *
 * Used by every status-change UI in the app: /queue, /fulfillment,
 * /pipeline (via SubOrderRow) and /deliveries (via DeliveryActions).
 */
export function ConfirmStatusModal({
  target,
  subOrderNumber,
  productTitle,
  customerName,
  customerPhone,
  onCancel,
  onConfirm,
}: {
  target: StatusCode;
  subOrderNumber: string;
  productTitle: string;
  customerName: string | null;
  customerPhone: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const targetLabel = STATUS_BY_CODE[target]?.label ?? target;
  const willNotify = isCustomerNotifyStatus(target);
  const tpl = willNotify ? TWILIO_STATUS_TEMPLATES[target] : null;
  const renderedBody = tpl
    ? renderTemplateBody(tpl.bodyAr, { subOrderNumber, productTitle })
    : null;
  const normalizedPhone = customerPhone ? normalizeSaudiPhone(customerPhone) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirm status change"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-lg border border-hairline bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.6px] text-ink-tertiary">
              Confirm status change
            </span>
            <h3 className="text-[15px] font-semibold text-ink-primary">
              Change to <span className="text-accent">{targetLabel}</span>?
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-tertiary hover:bg-neutral-100"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="flex flex-col gap-3 px-5 py-4 text-[13px]">
          <div className="flex flex-col gap-1 rounded-md bg-neutral-50 px-3 py-2 text-[12px] text-ink-secondary">
            <span><span className="text-ink-tertiary">Sub-order:</span> {subOrderNumber}</span>
            <span className="truncate"><span className="text-ink-tertiary">Product:</span> {productTitle}</span>
          </div>

          {willNotify && tpl ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-[0.6px] text-ink-tertiary">
                  Customer WhatsApp message
                </span>
                <span className="font-mono text-[10px] text-ink-tertiary" title="Twilio Content SID">
                  {tpl.sid}
                </span>
              </div>
              <div
                dir="rtl"
                lang="ar"
                className="whitespace-pre-wrap rounded-md border border-hairline bg-neutral-50/70 px-3 py-2 text-[13px] leading-relaxed text-ink-primary"
              >
                {renderedBody}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-tertiary">
                <span>
                  <span className="text-ink-tertiary">To:</span>{" "}
                  <span className="text-ink-secondary">{customerName ?? "—"}</span>
                </span>
                {normalizedPhone ? (
                  <span className="font-mono text-ink-secondary">{normalizedPhone}</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-status-danger-fg">
                    <AlertTriangle className="h-3 w-3" aria-hidden />
                    No valid Saudi phone — message will be skipped.
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-hairline-strong bg-neutral-50 px-3 py-2 text-[12px] text-ink-tertiary">
              Internal status change — no customer message will be sent.
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-hairline px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-hairline-strong bg-surface px-3 py-1.5 text-[12px] font-medium text-ink-primary transition-colors hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white shadow-sm transition-colors hover:bg-navy-deep"
          >
            Confirm change
          </button>
        </footer>
      </div>
    </div>
  );
}
