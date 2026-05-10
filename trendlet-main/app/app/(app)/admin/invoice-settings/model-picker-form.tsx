"use client";

import { useState, useTransition } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { setOcrModelAction } from "./actions";
import { cn } from "@/lib/utils";

type Model = {
  id: string;
  model_id: string;
  provider: string;
  display_name: string;
  cost_per_1k_input: number | null;
  cost_per_1k_output: number | null;
};

export function ModelPickerForm({
  currentModelId,
  models,
}: {
  currentModelId: string | null;
  models: Model[];
}) {
  const [selected, setSelected] = useState<string | null>(currentModelId);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const res = await setOcrModelAction({ modelId: selected });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSavedAt(new Date());
    });
  };

  if (models.length === 0) {
    return (
      <div className="rounded-md border border-hairline bg-surface p-4 text-[12px] text-ink-tertiary">
        No vision-capable AI models are active. Activate a row in{" "}
        <code>ai_models</code> with <code>use_case=&apos;ocr&apos;</code>.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-hairline bg-surface p-4">
      <div className="flex flex-col gap-2">
        {models.map((m) => {
          const isCurrent = m.model_id === selected;
          return (
            <label
              key={m.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
                isCurrent
                  ? "border-ink-primary bg-neutral-50"
                  : "border-hairline hover:bg-neutral-50/60",
              )}
            >
              <input
                type="radio"
                name="ocr-model"
                value={m.model_id}
                checked={isCurrent}
                onChange={() => setSelected(m.model_id)}
                className="mt-0.5"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink-primary">
                    {m.display_name}
                  </span>
                  <span className="rounded-sm bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-tertiary">
                    {m.provider}
                  </span>
                </div>
                <span className="text-[11px] text-ink-tertiary">
                  <code>{m.model_id}</code>
                </span>
                <span className="text-[11px] text-ink-tertiary">
                  {fmtCost(m.cost_per_1k_input)} input ·{" "}
                  {fmtCost(m.cost_per_1k_output)} output (per 1K tokens)
                </span>
              </div>
            </label>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-hairline pt-3">
        <span className="text-[11px] text-ink-tertiary">
          {savedAt
            ? `Saved ${savedAt.toLocaleTimeString("en-US")}`
            : currentModelId
            ? `Current: ${currentModelId}`
            : "No model selected yet."}
          {error && (
            <span className="ml-2 text-status-danger-fg">· {error}</span>
          )}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={pending || !selected || selected === currentModelId}
          className="inline-flex h-8 items-center gap-1 rounded-md bg-[#0f1419] px-3 text-[12px] font-medium text-white transition-colors hover:bg-[#1a2128] disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          )}
          Save
        </button>
      </div>
    </div>
  );
}

function fmtCost(n: number | null): string {
  if (n === null) return "—";
  return `$${n.toFixed(4)}`;
}
