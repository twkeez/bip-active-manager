import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchPriorityTasks } from "@/lib/tasks/priority-tasks";
import { loadClientListData } from "@/lib/dashboard/load-client-list-data";
import CommsMonitor from "@/components/dashboard/comms-monitor";
import { Star, Calendar } from "lucide-react";
import BasecampSyncButton from "@/components/dashboard/basecamp-sync-button";

function formatDueDate(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isOverdue(dateStr: string | null) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ clients, syncState }, priorityTasks] = await Promise.all([
    loadClientListData(supabase),
    fetchPriorityTasks(supabase, user.id).catch(() => []),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-[rgba(255,255,255,0.4)]">{user.email}</p>
        </div>
        <BasecampSyncButton lastSyncedAt={syncState?.last_synced_at} />
      </div>

      {/* Comms Monitor */}
      <section>
        <h2 className="bip-section-label mb-3">Comms Monitor</h2>
        <CommsMonitor clients={clients} />
      </section>

      {/* Priority Tasks */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="bip-section-label">Priority Tasks</h2>
          <Link href="/my-tasks" className="text-xs text-[var(--bip-accent)] hover:underline">
            View all →
          </Link>
        </div>
        <div className="bip-card divide-y divide-[var(--bip-border)]">
          {priorityTasks.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[rgba(255,255,255,0.3)]">
              No starred or upcoming tasks.
            </p>
          ) : (
            priorityTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bip-hover)] transition-colors"
              >
                {task.is_starred && (
                  <Star size={13} className="shrink-0 fill-amber-400 text-amber-400" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{task.title}</p>
                  {task.client_name && (
                    <p className="text-xs text-[rgba(255,255,255,0.4)]">{task.client_name}</p>
                  )}
                </div>
                {task.due_date && (
                  <span
                    className={`flex items-center gap-1 text-xs ${
                      isOverdue(task.due_date)
                        ? "text-[var(--bip-danger)]"
                        : "text-[rgba(255,255,255,0.4)]"
                    }`}
                  >
                    <Calendar size={11} />
                    {formatDueDate(task.due_date)}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
