"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, FileUp, Loader2, Paperclip, X } from "lucide-react";
import { uploadSupplierInvoiceAction } from "./upload-supplier-invoice-action";
import { cn } from "@/lib/utils";

export function SupplierInvoiceDropzone({
  subOrderId,
  hasReceipt,
}: {
  subOrderId: string;
  hasReceipt: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Once a receipt is attached, show a non-interactive badge. Re-uploading
  // is deferred to admin tooling — sourcers/fulfillers shouldn't silently
  // overwrite a colleague's link.
  if (hasReceipt) {
    return (
      <span
        className="inline-flex h-7 items-center gap-1 rounded-md border border-status-delivered-border/40 bg-status-delivered-bg px-2 text-[11px] font-medium text-status-delivered-fg"
        title="Supplier receipt attached"
      >
        <CheckCircle2 className="h-3 w-3" aria-hidden />
        Receipt
      </span>
    );
  }

  const upload = (file: File) => {
    setError(null);
    if (file.type !== "application/pdf") {
      setError("PDF only.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Max 10 MB.");
      return;
    }
    const fd = new FormData();
    fd.set("subOrderId", subOrderId);
    fd.set("file", file);
    startTransition(async () => {
      const result = await uploadSupplierInvoiceAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Successful upload — close panel; revalidatePath in the action
      // refreshes the row so the badge replaces the dropzone.
      setOpen(false);
    });
  };

  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) upload(file);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-hairline bg-surface px-2 text-[11px] font-medium text-ink-secondary transition-colors hover:bg-neutral-50"
      >
        <Paperclip className="h-3 w-3" aria-hidden />
        Upload receipt
      </button>
    );
  }

  return (
    <div className="basis-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-3 text-[12px] transition-colors",
          dragOver
            ? "border-ink-primary bg-neutral-50"
            : "border-hairline-strong bg-neutral-50/60",
          pending && "opacity-60",
        )}
      >
        <div className="flex items-center gap-2 text-ink-secondary">
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <FileUp className="h-4 w-4" aria-hidden />
          )}
          <span>
            {pending
              ? "Uploading…"
              : "Drop a PDF receipt here, or "}
            {!pending && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-medium text-ink-primary underline-offset-2 hover:underline"
              >
                browse
              </button>
            )}
            {!pending && " · PDF, max 10 MB"}
          </span>
          {error && (
            <span className="text-status-danger-fg">· {error}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={pending}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-tertiary hover:bg-neutral-100 disabled:opacity-50"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>
    </div>
  );
}
