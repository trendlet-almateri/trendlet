"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { recheckIntegrationsAction } from "./actions";
import { BrandSpinnerInline } from "@/components/spinner/brand-spinner";

export function RecheckButton() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function handleClick() {
    startTransition(async () => {
      const results = await recheckIntegrationsAction();
      const okCount = results.filter((r) => r.status === "ok").length;
      toast.success(`${okCount}/${results.length} integrations healthy`);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="flex h-9 items-center gap-2 rounded-md border border-hairline bg-surface px-3 text-[13px] font-medium text-ink-primary transition-colors hover:border-hairline-strong disabled:opacity-50"
    >
      {pending ? <BrandSpinnerInline size={16} /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
      {pending ? "Checking…" : "Re-check all"}
    </button>
  );
}
