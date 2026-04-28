"use client";

import { useFormState, useFormStatus } from "react-dom";
import { autoAssignAction, type AutoAssignState } from "./actions";
import { Button } from "@/components/ui/button";

const initial: AutoAssignState = { error: null, assignedTo: null };

function Inner({ subOrderNumber }: { subOrderNumber: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="secondary" disabled={pending}>
      {pending ? "Assigning…" : "Auto-assign"}
      <span className="sr-only"> sub-order {subOrderNumber}</span>
    </Button>
  );
}

export function AutoAssignButton({
  subOrderId,
  subOrderNumber,
}: {
  subOrderId: string;
  subOrderNumber: string;
}) {
  const [state, formAction] = useFormState(autoAssignAction, initial);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="subOrderId" value={subOrderId} />
      <Inner subOrderNumber={subOrderNumber} />
      {state.error && (
        <span role="alert" className="text-[11px] text-status-danger-fg">
          {state.error}
        </span>
      )}
    </form>
  );
}
