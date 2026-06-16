import Link from "next/link";
import { CalendarClock, Star } from "lucide-react";
import type { PriorityTask } from "@/lib/tasks/priority-tasks";
type Props = { tasks: PriorityTask[] };
function formatDueDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function isOverdue(value: string | null) {
  if (!value) return false;
  const today = new Date().toISOString().slice(0, 10);
  return value < today;
}
export default function PriorityTasksPanel({ tasks }: Props) {
  return (
    <section className="mb-5 rounded-xl border border-white/[0.08] bg-bip-card px-4 py-3 shadow-none shadow-black/20">
      
      <div className="mb-3 flex items-center justify-between gap-3">
        
        <div>
          
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
            
            Priority Tasks
          </h2>
          <p className="mt-0.5 text-[11px] text-white/50">
            
            Starred or due within 7 days
          </p>
        </div>
        <Link
          href="/my-tasks"
          className="text-[11px] font-medium text-bip-accent transition hover:text-bip-accent"
        >
          
          View all →
        </Link>
      </div>
      {tasks.length === 0 ? (
        <p className="py-2 text-sm text-white/50">No urgent tasks today</p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          
          {tasks.map((task) => {
            const dueLabel = formatDueDate(task.due_date);
            const overdue = isOverdue(task.due_date);
            return (
              <Link
                key={task.id}
                href="/my-tasks"
                className="group inline-flex min-w-[220px] max-w-[280px] shrink-0 items-center gap-2.5 rounded-lg border border-white/[0.08] bg-bip-page px-3 py-2 transition hover:border-white/[0.12] hover:bg-bip-card"
              >
                
                <Star
                  size={14}
                  className={
                    task.is_starred
                      ? "shrink-0 fill-amber-400 text-amber-400"
                      : "shrink-0 text-slate-600"
                  }
                />
                <div className="min-w-0 flex-1">
                  
                  <p className="truncate text-sm font-medium text-white group-hover:text-white">
                    
                    {task.title}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/50">
                    
                    {task.client_name ? (
                      <span className="truncate">{task.client_name}</span>
                    ) : null}
                    {dueLabel ? (
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 ${overdue ? "text-rose-400" : ""}`}
                      >
                        
                        <CalendarClock size={10} /> {dueLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
