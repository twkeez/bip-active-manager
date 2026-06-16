import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserTask } from "@/lib/types/client";

export type PriorityTask = {
  id: number;
  title: string;
  due_date: string | null;
  is_starred: boolean;
  client_name: string | null;
};

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sortPriorityTasks(a: PriorityTask, b: PriorityTask) {
  if (a.is_starred !== b.is_starred) return a.is_starred ? -1 : 1;
  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
  if (a.due_date) return -1;
  if (b.due_date) return 1;
  return 0;
}

export async function fetchPriorityTasks(
  supabase: SupabaseClient,
  userId: string,
): Promise<PriorityTask[]> {
  const weekEnd = toDateString(addDays(new Date(), 7));

  const { data: tasksRaw, error } = await supabase
    .from("user_tasks")
    .select("id, title, due_date, is_starred, client_id, status")
    .eq("owner_user_id", userId)
    .neq("status", "done")
    .or(`is_starred.eq.true,and(due_date.not.is.null,due_date.lte.${weekEnd})`)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  const tasks = (tasksRaw ?? []) as Pick<
    UserTask,
    "id" | "title" | "due_date" | "is_starred" | "client_id"
  >[];

  const clientIds = [...new Set(tasks.map((task) => task.client_id).filter(Boolean))] as number[];
  const clientNameById = new Map<number, string>();

  if (clientIds.length > 0) {
    const { data: clientsRaw } = await supabase
      .from("clients")
      .select("id, account_name")
      .in("id", clientIds);

    for (const client of clientsRaw ?? []) {
      clientNameById.set(client.id, client.account_name);
    }
  }

  return tasks
    .map((task) => ({
      id: task.id,
      title: task.title,
      due_date: task.due_date,
      is_starred: task.is_starred,
      client_name: task.client_id ? clientNameById.get(task.client_id) ?? null : null,
    }))
    .sort(sortPriorityTasks)
    .slice(0, 12);
}
