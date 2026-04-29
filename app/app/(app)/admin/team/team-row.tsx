"use client";

import { useTransition } from "react";
import { Loader2, Power } from "lucide-react";
import { setTeamMemberActiveAction } from "./actions";
import type { TeamMember } from "@/lib/queries/team";
import { cn } from "@/lib/utils";

export function TeamRow({
  member,
  isCurrentUser,
}: {
  member: TeamMember;
  isCurrentUser: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    if (isCurrentUser) return;
    startTransition(async () => {
      await setTeamMemberActiveAction({
        userId: member.id,
        active: !member.is_active,
      });
    });
  };

  return (
    <div
      className={cn(
        "grid grid-cols-[1.7fr_1.3fr_1.2fr_0.8fr_1.2fr_auto] items-center gap-3 rounded-md border border-hairline bg-surface p-3",
        !member.is_active && "opacity-60",
      )}
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-ink-primary">
          {member.full_name}
          {isCurrentUser && (
            <span className="ml-1.5 text-[10px] uppercase tracking-wider text-ink-tertiary">
              you
            </span>
          )}
        </span>
        <span className="truncate text-[11px] text-ink-tertiary">
          {member.email}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {member.roles.length === 0 ? (
          <span className="text-[11px] text-ink-tertiary">—</span>
        ) : (
          member.roles.map((r) => (
            <span
              key={r}
              className="rounded-sm bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-secondary"
            >
              {r}
            </span>
          ))
        )}
      </div>

      <span className="text-[12px] text-ink-secondary">
        {member.region ?? "—"}
      </span>

      <span
        className={cn(
          "inline-flex h-5 w-fit items-center gap-1 rounded-sm border px-1.5 text-[10px] font-medium",
          member.is_active
            ? "border-status-delivered-border/40 bg-status-delivered-bg text-status-delivered-fg"
            : "border-status-danger-border/40 bg-status-danger-bg text-status-danger-fg",
        )}
      >
        {member.is_active ? "Active" : "Inactive"}
      </span>

      <span className="text-[11px] text-ink-tertiary">
        {member.last_seen_at
          ? `Seen ${formatRelative(member.last_seen_at)}`
          : member.joined_at
          ? `Joined ${formatRelative(member.joined_at)}`
          : "Pending"}
      </span>

      <button
        type="button"
        onClick={toggle}
        disabled={pending || isCurrentUser}
        title={isCurrentUser ? "You can't deactivate yourself" : ""}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-hairline bg-surface px-2 text-[11px] font-medium text-ink-secondary transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        ) : (
          <Power className="h-3 w-3" aria-hidden />
        )}
        {member.is_active ? "Deactivate" : "Activate"}
      </button>
    </div>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (24 * 3600 * 1000));
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
