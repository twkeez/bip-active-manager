"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, ShieldCheck, UserPlus } from "lucide-react";
import type { UserRole } from "@/lib/auth/profile";

export type TeamMember = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
};

export default function TeamManager({
  initialMembers,
  currentUserId,
}: {
  initialMembers: TeamMember[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);

  // Invite form
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("strategist");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteOk, setInviteOk] = useState<string | null>(null);

  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const adminCount = members.filter((m) => m.role === "admin").length;

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (inviting) return;
    setInviting(true);
    setInviteError(null);
    setInviteOk(null);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invite failed.");
      setInviteOk(`Invite sent to ${data.email}.`);
      setEmail("");
      setFullName("");
      setRole("strategist");
      router.refresh();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Invite failed.");
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(member: TeamMember, nextRole: UserRole) {
    if (nextRole === member.role) return;
    setSavingId(member.id);
    setRowError(null);
    const prev = members;
    setMembers((ms) => ms.map((m) => (m.id === member.id ? { ...m, role: nextRole } : m)));
    try {
      const res = await fetch("/api/team/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.id, role: nextRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not change role.");
    } catch (err) {
      setMembers(prev); // revert
      setRowError(err instanceof Error ? err.message : "Could not change role.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bip-accent/10 text-bip-accent">
          <ShieldCheck size={20} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-bip-text">Team</h1>
          <p className="text-sm text-bip-muted">Invite staff and manage their roles. Accounts are invite-only.</p>
        </div>
      </div>

      {/* Invite */}
      <section className="mb-8 rounded-xl border border-bip-border bg-bip-card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-bip-text">
          <UserPlus size={16} className="text-bip-accent" /> Invite a teammate
        </h2>
        <form onSubmit={invite} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@beyondindigo.com"
            required
            className="rounded-lg border border-bip-border bg-bip-page px-3 py-2 text-sm text-bip-text outline-none focus:border-bip-accent"
          />
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            className="rounded-lg border border-bip-border bg-bip-page px-3 py-2 text-sm text-bip-text outline-none focus:border-bip-accent"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="rounded-lg border border-bip-border bg-bip-page px-3 py-2 text-sm text-bip-text outline-none focus:border-bip-accent"
          >
            <option value="strategist">Strategist</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={inviting || !email.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-bip-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {inviting ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
            Send invite
          </button>
        </form>
        {inviteError && <p className="mt-3 rounded-lg border border-bip-danger/30 bg-bip-danger/10 px-3 py-2 text-sm text-bip-danger">{inviteError}</p>}
        {inviteOk && <p className="mt-3 rounded-lg border border-bip-accent/30 bg-bip-accent/10 px-3 py-2 text-sm text-bip-accent">{inviteOk}</p>}
      </section>

      {/* Members */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-bip-text">Members ({members.length})</h2>
        {rowError && <p className="mb-3 rounded-lg border border-bip-danger/30 bg-bip-danger/10 px-3 py-2 text-sm text-bip-danger">{rowError}</p>}
        <div className="overflow-hidden rounded-xl border border-bip-border">
          <table className="w-full text-sm">
            <thead className="bg-bip-card/50 text-[11px] uppercase tracking-wide text-bip-muted">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Name</th>
                <th className="px-4 py-2.5 text-left font-semibold">Email</th>
                <th className="px-4 py-2.5 text-right font-semibold">Role</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isSelf = m.id === currentUserId;
                const isLastAdmin = m.role === "admin" && adminCount <= 1;
                return (
                  <tr key={m.id} className="border-t border-bip-border">
                    <td className="px-4 py-2.5 text-bip-text">
                      {m.full_name || "—"}
                      {isSelf && <span className="ml-2 text-[10px] uppercase tracking-wide text-bip-subtle">you</span>}
                    </td>
                    <td className="px-4 py-2.5 text-bip-muted">{m.email}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="inline-flex items-center gap-2">
                        {savingId === m.id && <Loader2 size={13} className="animate-spin text-bip-muted" />}
                        <select
                          value={m.role}
                          disabled={savingId === m.id || isLastAdmin}
                          title={isLastAdmin ? "Can't demote the last admin" : undefined}
                          onChange={(e) => changeRole(m, e.target.value as UserRole)}
                          className="rounded-lg border border-bip-border bg-bip-page px-2 py-1 text-xs text-bip-text outline-none focus:border-bip-accent disabled:opacity-60"
                        >
                          <option value="strategist">Strategist</option>
                          <option value="admin">Admin</option>
                        </select>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
