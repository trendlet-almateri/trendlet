import { Mail } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-role";
import { fetchTeamMembers, fetchPendingInvitations } from "@/lib/queries/team";
import { InviteForm } from "./invite-form";
import { TeamRow } from "./team-row";

export const dynamic = "force-dynamic";

export const metadata = { title: "Team · Trendslet Operations" };

export default async function AdminTeamPage() {
  const admin = await requireAdmin();
  const [members, pending] = await Promise.all([
    fetchTeamMembers(),
    fetchPendingInvitations(),
  ]);

  const active = members.filter((m) => m.is_active);
  const inactive = members.filter((m) => !m.is_active);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-h1 text-ink-primary">Team</h1>
        <span className="text-[12px] text-ink-tertiary">
          {active.length} active
          {inactive.length > 0 && ` · ${inactive.length} inactive`}
          {pending.length > 0 && ` · ${pending.length} pending invite${pending.length === 1 ? "" : "s"}`}
        </span>
      </header>

      <InviteForm />

      {/* Column headers */}
      {members.length > 0 && (
        <div className="grid grid-cols-[1.7fr_1.3fr_1.2fr_0.8fr_1.2fr_auto] items-center gap-3 px-3 text-[10px] font-medium uppercase tracking-[0.4px] text-ink-tertiary">
          <span>Member</span>
          <span>Roles</span>
          <span>Region</span>
          <span>Status</span>
          <span>Activity</span>
          <span className="justify-self-end">&nbsp;</span>
        </div>
      )}

      {members.length > 0 && (
        <div className="flex flex-col gap-2">
          {members.map((m) => (
            <TeamRow key={m.id} member={m} isCurrentUser={m.id === admin.id} />
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.4px] text-ink-tertiary">
            <Mail className="h-3 w-3" aria-hidden /> Pending invitations
          </h2>
          <div className="flex flex-col divide-y divide-hairline rounded-md border border-hairline">
            {pending.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 px-3 py-2 text-[12px]"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium text-ink-primary">
                    {p.full_name}
                  </span>
                  <span className="text-[11px] text-ink-tertiary">
                    {p.email} · {p.roles.join(", ") || "no role"}
                    {p.region && ` · ${p.region}`}
                  </span>
                </div>
                <span className="text-[11px] text-ink-tertiary">
                  Expires{" "}
                  {new Date(p.expires_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
