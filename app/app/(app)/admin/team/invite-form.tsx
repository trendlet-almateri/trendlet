"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useRef } from "react";
import { Loader2, UserPlus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { inviteTeamMemberAction, type InviteState } from "./actions";

const initialState: InviteState = { ok: false, error: null };

export function InviteForm() {
  const [state, dispatch] = useFormState(inviteTeamMemberAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <section className="rounded-md border border-dashed border-hairline-strong bg-neutral-50 p-3">
      <h2 className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">
        <UserPlus className="h-3 w-3" aria-hidden /> Invite team member
      </h2>
      <form
        ref={formRef}
        action={dispatch}
        className="grid grid-cols-[2fr_1.5fr_1fr_0.8fr_auto] items-center gap-3"
      >
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          placeholder="email@trendlet.com"
          className="rounded-md border border-hairline bg-surface px-2 py-1.5 text-[13px] font-medium text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-navy/20"
        />
        <input
          name="full_name"
          type="text"
          required
          maxLength={120}
          placeholder="Full name"
          className="rounded-md border border-hairline bg-surface px-2 py-1.5 text-[13px] text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-navy/20"
        />
        <select
          name="role"
          required
          defaultValue="sourcing"
          className="rounded-md border border-hairline bg-surface px-2 py-1.5 text-[12px] text-ink-primary focus:outline-none focus:ring-2 focus:ring-navy/20"
        >
          <option value="sourcing">sourcing</option>
          <option value="fulfiller">fulfiller</option>
          <option value="warehouse">warehouse</option>
          <option value="ksa_operator">ksa_operator</option>
          <option value="admin">admin</option>
        </select>
        <select
          name="region"
          defaultValue=""
          className="rounded-md border border-hairline bg-surface px-2 py-1.5 text-[12px] text-ink-primary focus:outline-none focus:ring-2 focus:ring-navy/20"
        >
          <option value="">— region —</option>
          <option value="US">US</option>
          <option value="EU">EU</option>
          <option value="KSA">KSA</option>
          <option value="GLOBAL">GLOBAL</option>
        </select>
        <div className="flex items-center gap-2 justify-self-end">
          <SubmitButton />
          {state.error && (
            <span
              className="flex items-center gap-1 text-[11px] text-status-danger-fg"
              title={state.error}
            >
              <AlertTriangle className="h-3 w-3" aria-hidden /> {state.error}
            </span>
          )}
          {state.ok && (
            <span className="flex items-center gap-1 text-[11px] text-status-delivered-fg">
              <CheckCircle2 className="h-3 w-3" aria-hidden /> Invitation sent
            </span>
          )}
        </div>
      </form>
      <p className="mt-2 text-[11px] text-ink-tertiary">
        The invitee receives a Supabase email with a setup link. They pick
        their own password on first sign-in.
      </p>
    </section>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-7 items-center gap-1 rounded-md bg-[#0f1419] px-3 text-[11px] font-medium text-white transition-colors hover:bg-[#1a2128] disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      ) : (
        <UserPlus className="h-3 w-3" aria-hidden />
      )}
      Send invite
    </button>
  );
}
