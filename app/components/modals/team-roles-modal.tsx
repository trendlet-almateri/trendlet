"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X, Search, Users, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

type TeamMember = {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  roles: string[];
  region: string | null;
  joined_at: string | null;
  last_seen_at: string | null;
};

type PendingInvitation = {
  id: string;
  email: string;
  full_name: string;
  roles: string[];
  expires_at: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  sourcing: "Sourcing",
  warehouse: "Warehouse",
  fulfiller: "Fulfiller",
  ksa_operator: "KSA Operator",
};

const AVATAR_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500",
  "bg-amber-500", "bg-rose-500", "bg-cyan-500",
  "bg-orange-500", "bg-indigo-500",
];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return "Just now";
  if (hours < 1) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TeamRolesModal({ onClose }: { onClose: () => void }) {
  const [members, setMembers] = React.useState<TeamMember[]>([]);
  const [pending, setPending] = React.useState<PendingInvitation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeFilter, setActiveFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    fetch("/api/admin/team")
      .then((r) => r.json())
      .then(({ members, pending }) => {
        setMembers(members ?? []);
        setPending(pending ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const ALL_ROLES = ["admin", "sourcing", "warehouse", "fulfiller", "ksa_operator"];
  const roleCounts = Object.fromEntries(
    ALL_ROLES.map((r) => [r, members.filter((m) => m.roles.includes(r)).length]),
  );

  const filtered = members.filter((m) => {
    const matchRole = activeFilter === "all" || m.roles.includes(activeFilter);
    const q = search.toLowerCase();
    const matchSearch = !q || m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
    return matchRole && matchSearch;
  });

  const content = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[rgba(15,20,25,0.5)]"
        style={{ animation: "backdropIn 0.2s ease forwards" }}
        onClick={onClose}
      />
      <div
        className="relative flex h-[640px] w-full max-w-[920px] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-md)]"
        style={{ animation: "riseIn 0.2s cubic-bezier(0.16,1,0.3,1) forwards" }}
      >
        {/* ── Left sidebar ── */}
        <aside className="flex w-[240px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--hover)]">
          <div className="flex items-center gap-2.5 px-4 py-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)]">
              <Users className="h-4 w-4 text-white" aria-hidden />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-semibold text-[var(--ink)]">Team &amp; roles</span>
              <span className="text-[11px] text-[var(--muted)]">Trendslet workspace</span>
            </div>
          </div>

          <div className="mx-3 h-px bg-[var(--line)]" />

          <div className="flex flex-col gap-0.5 p-2 pt-3">
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--muted)]">
              Filter by role
            </p>
            <SidebarFilter label="All members" count={members.length} active={activeFilter === "all"} onClick={() => setActiveFilter("all")} />
            {ALL_ROLES.map((role) => (
              <SidebarFilter
                key={role}
                label={ROLE_LABELS[role]}
                count={roleCounts[role]}
                active={activeFilter === role}
                onClick={() => setActiveFilter(role)}
              />
            ))}
          </div>

          {pending.length > 0 && (
            <>
              <div className="mx-3 mt-2 h-px bg-[var(--line)]" />
              <div className="flex flex-col gap-0.5 p-2 pt-3">
                <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--muted)]">Other</p>
                <SidebarFilter label="Pending invites" count={pending.length} active={false} onClick={() => {}} />
              </div>
            </>
          )}

          <div className="flex-1" />

          <div className="border-t border-[var(--line)] p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--muted)]">Seats</p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]">
              <div
                className="bar-fill h-full rounded-full bg-[var(--accent)]"
                style={{ width: `${Math.min(100, Math.round((members.length / Math.max(members.length + 6, 1)) * 100))}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--muted)]">
              {members.length} used
            </p>
          </div>
        </aside>

        {/* ── Right content ── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-[var(--line)] px-6 py-4">
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--ink)]">Team members</h2>
              <p className="text-[12px] text-[var(--muted)]">
                Manage who can access the Trendslet workspace and what they can do.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/admin/team"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden />
                Invite members
              </a>
              <button
                type="button"
                onClick={onClose}
                className="grid h-7 w-7 place-items-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--line)] hover:text-[var(--ink)]"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="border-b border-[var(--line)] px-4 py-2.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" aria-hidden />
              <input
                type="text"
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] pl-8 pr-3 text-[12px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
              />
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[2fr_1.2fr_0.8fr_1fr_32px] items-center gap-3 border-b border-[var(--line)] bg-[var(--hover)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.4px] text-[var(--muted)]">
            <span>Member</span>
            <span>Role</span>
            <span>Status</span>
            <span>Last active</span>
            <span />
          </div>

          {/* Member rows */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-16 text-[12px] text-[var(--muted)]">Loading…</div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="flex items-center justify-center py-16 text-[12px] text-[var(--muted)]">No members found.</div>
            )}
            {!loading && filtered.map((m) => <MemberRow key={m.id} member={m} />)}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

function SidebarFilter({
  label, count, active, onClick,
}: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px] transition-colors text-left",
        active
          ? "bg-[var(--accent)]/10 font-medium text-[var(--accent)]"
          : "text-[var(--muted)] hover:bg-[var(--line)] hover:text-[var(--ink)]",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", active ? "bg-[var(--accent)]" : "bg-[var(--line)]")} />
        {label}
      </div>
      <span className="text-[11px] tabular-nums">{count}</span>
    </button>
  );
}

function MemberRow({ member: m }: { member: TeamMember }) {
  const initials = getInitials(m.full_name);
  const avatarCls = avatarColor(m.full_name);

  return (
    <div className="grid grid-cols-[2fr_1.2fr_0.8fr_1fr_32px] items-center gap-3 border-b border-[var(--line)] px-4 py-2.5 transition-colors hover:bg-[var(--hover)] last:border-0">
      {/* Member */}
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={cn("relative grid h-8 w-8 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white", avatarCls)}>
          {initials}
          <span
            className={cn(
              "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white",
              m.is_active ? "bg-[var(--green)]" : "bg-[var(--muted-2)]",
            )}
          />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[13px] font-medium text-[var(--ink)]">{m.full_name}</span>
          <span className="truncate text-[11px] text-[var(--muted)]">{m.email}</span>
        </div>
      </div>

      {/* Roles */}
      <div className="flex flex-wrap gap-1">
        {m.roles.length === 0 ? (
          <span className="text-[11px] text-[var(--muted)]">—</span>
        ) : (
          m.roles.map((r) => (
            <span
              key={r}
              className="rounded-full border border-[var(--line)] bg-[var(--hover)] px-2 py-px text-[10px] font-medium text-[var(--muted)]"
            >
              {ROLE_LABELS[r] ?? r}
            </span>
          ))
        )}
      </div>

      {/* Status */}
      <div className="flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", m.is_active ? "bg-[var(--green)]" : "bg-[var(--muted-2)]")} />
        <span className="text-[12px] text-[var(--muted)]">{m.is_active ? "Active" : "Inactive"}</span>
      </div>

      {/* Last active */}
      <span className="text-[12px] text-[var(--muted)]">
        {m.last_seen_at
          ? formatRelative(m.last_seen_at)
          : m.joined_at
            ? formatRelative(m.joined_at)
            : "Pending"}
      </span>

      {/* Menu */}
      <button
        type="button"
        className="grid h-6 w-6 place-items-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--line)] hover:text-[var(--ink)]"
        aria-label="More options"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>
    </div>
  );
}
