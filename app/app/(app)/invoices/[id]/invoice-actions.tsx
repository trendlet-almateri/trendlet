"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { Check, X, Send, RotateCcw, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  approveInvoiceAction,
  rejectInvoiceAction,
  reopenInvoiceAction,
  markSentAction,
  type ActionState,
} from "./actions";

type InvoiceStatus = "draft" | "pending_review" | "approved" | "sent" | "rejected";

type Props = {
  invoiceId: string;
  status: InvoiceStatus;
  rejectionReason: string | null;
  sentAt: string | null;
  sentToEmail: string | null;
  customerEmail: string | null;
  /** True when the server has full Zoho credentials. Drives the
   *  Send button copy ("Send to customer" vs "Mark sent"). */
  zohoLive: boolean;
};

const initialState: ActionState = { ok: false, error: null };

export function InvoiceActions({
  invoiceId,
  status,
  rejectionReason,
  sentAt,
  sentToEmail,
  customerEmail,
  zohoLive,
}: Props) {
  if (status === "draft") {
    return (
      <Banner tone="muted">
        Draft — sourcing has not yet submitted this for review.
      </Banner>
    );
  }

  if (status === "pending_review") {
    return <PendingActions invoiceId={invoiceId} />;
  }

  if (status === "approved") {
    return (
      <ApprovedActions
        invoiceId={invoiceId}
        customerEmail={customerEmail}
        zohoLive={zohoLive}
      />
    );
  }

  if (status === "sent") {
    return (
      <Banner tone="success">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">Sent to customer</span>
          {sentToEmail && (
            <span className="text-[11px] opacity-80">
              {sentToEmail}
              {sentAt && ` · ${new Date(sentAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`}
            </span>
          )}
        </div>
      </Banner>
    );
  }

  if (status === "rejected") {
    return (
      <RejectedActions invoiceId={invoiceId} rejectionReason={rejectionReason} />
    );
  }

  return null;
}

/* ── pending_review ──────────────────────────────────────────────────── */

function PendingActions({ invoiceId }: { invoiceId: string }) {
  const [showReject, setShowReject] = useState(false);
  const [approveState, approveDispatch] = useFormState(approveInvoiceAction, initialState);
  const [rejectState, rejectDispatch] = useFormState(rejectInvoiceAction, initialState);

  return (
    <section className="rounded-md border border-hairline bg-surface p-4">
      <h2 className="text-[10px] mb-3 font-medium uppercase tracking-[0.14em] text-ink-tertiary">
        Review
      </h2>

      {!showReject ? (
        <div className="flex flex-col gap-2">
          <form action={approveDispatch} className="flex flex-col gap-2">
            <input type="hidden" name="id" value={invoiceId} />
            <SubmitButton variant="primary" pendingLabel="Approving…">
              <Check className="h-4 w-4" aria-hidden /> Approve
            </SubmitButton>
          </form>
          <Button
            variant="secondary"
            onClick={() => setShowReject(true)}
            type="button"
          >
            <X className="h-4 w-4" aria-hidden /> Reject
          </Button>
          {approveState.error && <ErrorLine message={approveState.error} />}
        </div>
      ) : (
        <form action={rejectDispatch} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={invoiceId} />
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-[0.4px] text-ink-tertiary">
              Reason
            </span>
            <textarea
              name="reason"
              required
              minLength={3}
              maxLength={500}
              rows={3}
              placeholder="Why is this rejected? Sourcing will use this to fix the draft."
              className="rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-navy/20"
            />
          </label>
          <div className="flex gap-2">
            <SubmitButton variant="danger" pendingLabel="Rejecting…">
              <X className="h-4 w-4" aria-hidden /> Confirm reject
            </SubmitButton>
            <Button variant="ghost" onClick={() => setShowReject(false)} type="button">
              Cancel
            </Button>
          </div>
          {rejectState.error && <ErrorLine message={rejectState.error} />}
        </form>
      )}
    </section>
  );
}

/* ── approved ────────────────────────────────────────────────────────── */

function ApprovedActions({
  invoiceId,
  customerEmail,
  zohoLive,
}: {
  invoiceId: string;
  customerEmail: string | null;
  zohoLive: boolean;
}) {
  const [state, dispatch] = useFormState(markSentAction, initialState);
  const buttonLabel = zohoLive ? "Send to customer" : "Mark sent";
  const pendingLabel = zohoLive ? "Sending…" : "Marking…";
  const caption = zohoLive
    ? `Will email PDF to ${customerEmail}`
    : `Will mark sent to ${customerEmail}`;

  return (
    <section className="rounded-md border border-hairline bg-surface p-4">
      <h2 className="text-[10px] mb-3 font-medium uppercase tracking-[0.14em] text-ink-tertiary">
        Send
      </h2>
      <form action={dispatch} className="flex flex-col gap-2">
        <input type="hidden" name="id" value={invoiceId} />
        <SubmitButton variant="primary" pendingLabel={pendingLabel} disabled={!customerEmail}>
          <Send className="h-4 w-4" aria-hidden /> {buttonLabel}
        </SubmitButton>
        {customerEmail ? (
          <span className="text-[11px] text-ink-tertiary">{caption}</span>
        ) : (
          <span className="text-[11px] text-status-danger-fg">
            No customer email on file. Add one before sending.
          </span>
        )}
        {state.error && <ErrorLine message={state.error} />}
      </form>
    </section>
  );
}

/* ── rejected ────────────────────────────────────────────────────────── */

function RejectedActions({
  invoiceId,
  rejectionReason,
}: {
  invoiceId: string;
  rejectionReason: string | null;
}) {
  const [state, dispatch] = useFormState(reopenInvoiceAction, initialState);

  return (
    <section className="rounded-md border border-status-danger-border/40 bg-status-danger-bg p-4">
      <h2 className="text-[10px] mb-2 font-medium uppercase tracking-[0.14em] text-status-danger-fg">
        Rejected
      </h2>
      {rejectionReason && (
        <p className="mb-3 text-[13px] text-status-danger-fg">{rejectionReason}</p>
      )}
      <form action={dispatch} className="flex flex-col gap-2">
        <input type="hidden" name="id" value={invoiceId} />
        <SubmitButton variant="secondary" pendingLabel="Reopening…">
          <RotateCcw className="h-4 w-4" aria-hidden /> Re-review
        </SubmitButton>
        {state.error && <ErrorLine message={state.error} />}
      </form>
    </section>
  );
}

/* ── primitives ──────────────────────────────────────────────────────── */

function SubmitButton({
  children,
  variant,
  pendingLabel,
  disabled,
}: {
  children: React.ReactNode;
  variant: "primary" | "secondary" | "danger" | "ghost";
  pendingLabel: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button variant={variant} disabled={pending || disabled} type="submit">
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "success" | "muted";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-md p-4 text-[13px]",
        tone === "success" &&
          "border border-status-delivered-border/40 bg-status-delivered-bg text-status-delivered-fg",
        tone === "muted" && "border border-hairline bg-surface text-ink-secondary",
      )}
    >
      {children}
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-1.5 text-[11px] text-status-danger-fg">
      <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden />
      {message}
    </p>
  );
}
