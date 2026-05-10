"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { regenerateInvoicePdfAction, type ActionState } from "./actions";

const initialState: ActionState = { ok: false, error: null };

export function RegeneratePdfButton({ invoiceId }: { invoiceId: string }) {
  const [state, dispatch] = useFormState(regenerateInvoicePdfAction, initialState);

  return (
    <form action={dispatch} className="flex items-center gap-2">
      <input type="hidden" name="id" value={invoiceId} />
      <Submit />
      {state.error && (
        <span
          className="flex items-center gap-1 text-[11px] text-status-danger-fg"
          title={state.error}
        >
          <AlertTriangle className="h-3 w-3" aria-hidden />
          Failed
        </span>
      )}
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button variant="ghost" type="submit" disabled={pending} className="h-7 px-2 text-[11px]">
      {pending ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Regenerating…
        </>
      ) : (
        <>
          <RefreshCw className="h-3 w-3" aria-hidden /> Regenerate
        </>
      )}
    </Button>
  );
}
