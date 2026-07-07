"use client";

import { useRouter } from "next/navigation";
import { toCockpitViewModel } from "@/lib/dashboard/cockpit-view-model";
import type { ClientWorkspaceInitialData } from "@/lib/dashboard/client-workspace-types";
import type { ClientRow } from "@/lib/types/client";
import { norm, activeServiceLabels, getClientActiveServices } from "@/lib/clients/service-active";

type ClientStub = Pick<ClientRow, "id" | "account_name" | "marketing_strategist" | "tier">;

export default function CockpitSandbox({
  clients,
  selectedId,
  workspace,
}: {
  clients: ClientStub[];
  selectedId: number | null;
  workspace: ClientWorkspaceInitialData | null;
}) {
  const router = useRouter();

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val) {
      router.push(`/dashboard/cockpit?client=${val}`);
    } else {
      router.push("/dashboard/cockpit");
    }
  }

  const cockpit = workspace ? toCockpitViewModel(workspace) : null;
  const client = workspace?.client ?? null;
  const p1Items = cockpit?.focus.filter((f) => f.priority === "P1") ?? [];
  const p2Items = cockpit?.focus.filter((f) => f.priority === "P2") ?? [];
  const wins = cockpit?.features.filter((f) => !f.title.startsWith("No clean wins")) ?? [];

  const services = client ? activeServiceLabels(getClientActiveServices(client)) : [];
  const pkgHours = client?.total_package_hours ?? 0;
  const stratHours = client?.hours_for_strategist ?? 0;
  const hoursPercent = pkgHours > 0 ? Math.min(100, (stratHours / pkgHours) * 100) : 0;

  return (
    <div
      data-theme="light"
      className="flex flex-1 flex-col min-h-screen bg-neutral-50 font-sans"
    >
      {/* Top bar */}
      <div className="border-b border-neutral-200 bg-white px-6 py-4 flex items-center gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 mb-1">
            Cockpit sandbox
          </p>
          <p className="text-xs text-neutral-400">
            Pick a client to preview. Internal only — not deployed yet.
          </p>
        </div>
        <div className="ml-auto">
          <select
            value={selectedId ?? ""}
            onChange={handleSelect}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 shadow-sm focus:border-indigo-500 focus:outline-none min-w-[280px]"
          >
            <option value="">— Select a client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.account_name}
                {c.marketing_strategist ? ` · ${c.marketing_strategist}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {!workspace || !client || !cockpit ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-neutral-400">
            Select a client above to load the cockpit.
          </p>
        </div>
      ) : (
        <div className="p-6 space-y-5">

          {/* ── Header info ─────────────────────────────────────── */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <div className="flex flex-wrap items-start gap-6">

              {/* Name */}
              <div className="flex-1">
                <h1 className="text-xl font-bold text-neutral-900">
                  {client.account_name}
                </h1>
                <p className="mt-0.5 text-sm text-neutral-400">
                  #{client.id}
                  {norm(client.marketing_strategist)
                    ? ` · ${client.marketing_strategist}`
                    : ""}
                </p>
              </div>

              {/* Status */}
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
                  Status
                </p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
                {norm(client.tier) && (
                  <p className="mt-1.5 text-[11px] text-neutral-400">{client.tier}</p>
                )}
                {services.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {services.map((s) => (
                      <span
                        key={s}
                        className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Hours */}
              {pkgHours > 0 && (
                <div className="min-w-[160px]">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
                    Monthly hours
                  </p>
                  <p className="text-sm font-semibold text-neutral-800">
                    {stratHours} / {pkgHours} hrs
                  </p>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-neutral-200">
                    <div
                      className="h-1.5 rounded-full bg-indigo-500 transition-all"
                      style={{ width: `${hoursPercent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-neutral-400">
                    {Math.round(hoursPercent)}% used
                  </p>
                </div>
              )}

              {/* Contact */}
              {(client.contact_name ?? client.contact_email) && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
                    Contact
                  </p>
                  <p className="text-sm font-medium text-neutral-800">
                    {client.contact_name ?? "—"}
                  </p>
                  {client.contact_email && (
                    <p className="text-xs text-neutral-500">{client.contact_email}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Urgent bar (Command Center) ──────────────────────── */}
          <div>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
              Command Center
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

              {/* Critical */}
              <div
                className={`rounded-xl border-l-4 p-4 ${
                  p1Items.length > 0
                    ? "border-red-500 bg-red-50"
                    : "border-neutral-200 bg-white"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      p1Items.length > 0 ? "bg-red-500" : "bg-neutral-300"
                    }`}
                  />
                  <span
                    className={`text-sm font-semibold ${
                      p1Items.length > 0 ? "text-red-700" : "text-neutral-400"
                    }`}
                  >
                    Critical: {p1Items.length}
                  </span>
                </div>
                {p1Items.length === 0 ? (
                  <p className="text-xs text-neutral-400">No critical issues</p>
                ) : (
                  <>
                    {p1Items.slice(0, 3).map((item, i) => (
                      <p key={i} className="mt-1 text-xs leading-snug text-red-700">
                        {item.title}
                      </p>
                    ))}
                    {p1Items.length > 3 && (
                      <p className="mt-1 text-[11px] text-red-400">
                        +{p1Items.length - 3} more
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Warning */}
              <div
                className={`rounded-xl border-l-4 p-4 ${
                  p2Items.length > 0
                    ? "border-amber-400 bg-amber-50"
                    : "border-neutral-200 bg-white"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      p2Items.length > 0 ? "bg-amber-400" : "bg-neutral-300"
                    }`}
                  />
                  <span
                    className={`text-sm font-semibold ${
                      p2Items.length > 0 ? "text-amber-700" : "text-neutral-400"
                    }`}
                  >
                    Warning: {p2Items.length}
                  </span>
                </div>
                {p2Items.length === 0 ? (
                  <p className="text-xs text-neutral-400">No warnings</p>
                ) : (
                  <>
                    {p2Items.slice(0, 3).map((item, i) => (
                      <p key={i} className="mt-1 text-xs leading-snug text-amber-700">
                        {item.title}
                      </p>
                    ))}
                    {p2Items.length > 3 && (
                      <p className="mt-1 text-[11px] text-amber-500">
                        +{p2Items.length - 3} more
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Good */}
              <div
                className={`rounded-xl border-l-4 p-4 ${
                  wins.length > 0
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-neutral-200 bg-white"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      wins.length > 0 ? "bg-emerald-500" : "bg-neutral-300"
                    }`}
                  />
                  <span
                    className={`text-sm font-semibold ${
                      wins.length > 0 ? "text-emerald-700" : "text-neutral-400"
                    }`}
                  >
                    Good: {wins.length}
                  </span>
                </div>
                {wins.length === 0 ? (
                  <p className="text-xs text-neutral-400">
                    Address critical items first
                  </p>
                ) : (
                  wins.slice(0, 3).map((win, i) => (
                    <p key={i} className="mt-1 text-xs leading-snug text-emerald-700">
                      {win.title}
                    </p>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
