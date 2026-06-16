import type { ClientRow } from "@/lib/types/client";
import { isLowContactTier } from "@/lib/clients/service-active";
export type ClientDisplayStatus = "Active" | "Awaiting" | "Pending" | "Paused";
const STATUS_BADGE_CLASS: Record<ClientDisplayStatus, string> = {
  Active: "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  Awaiting: "border border-amber-500/20 bg-amber-500/10 text-amber-400",
  Pending: "border border-amber-500/20 bg-amber-500/10 text-amber-400",
  Paused: "border border-white/[0.08] bg-white/[0.06] text-white/50",
};
export function resolveClientStatus(
  client: Pick<ClientRow, "needs_reply" | "reply_acknowledged_at" | "tier">,
): ClientDisplayStatus {
  if (isLowContactTier(client.tier)) return "Paused";
  if (client.needs_reply) return "Awaiting";
  if (client.reply_acknowledged_at) return "Pending";
  return "Active";
}
export function clientStatusBadgeClass(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "active") return STATUS_BADGE_CLASS.Active;
  if (normalized === "awaiting" || normalized === "pending") {
    return STATUS_BADGE_CLASS.Awaiting;
  }
  if (normalized === "paused") return STATUS_BADGE_CLASS.Paused;
  return "bg-white/[0.06] text-white/75";
}
type Props = { status: ClientDisplayStatus | string; title?: string };
export default function ClientStatusBadge({ status, title }: Props) {
  const label =
    typeof status === "string" && status.length
      ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
      : "Active";
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${clientStatusBadgeClass(label)}`}
    >
      
      {label}
    </span>
  );
}
export function ClientRowStatusBadge({
  client,
}: {
  client: Pick<ClientRow, "needs_reply" | "reply_acknowledged_at" | "tier">;
}) {
  const status = resolveClientStatus(client);
  const title =
    status === "Awaiting"
      ? "Client sent the last message — response needed"
      : status === "Pending"
        ? "Reply acknowledged — no response required yet"
        : status === "Paused"
          ? "Low-contact tier"
          : "No pending reply";
  return <ClientStatusBadge status={status} title={title} />;
}
