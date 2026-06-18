import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

type ChatMessage = { role: "user" | "assistant"; content: string };
type Body = { message?: string; history?: ChatMessage[] };

const client = new Anthropic();
const MODEL = "claude-opus-4-8";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const taskId = Number(params.id);
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: task, error: taskError } = await supabase
    .from("user_tasks")
    .select("id,title,description,notes,priority,status,due_date,updated_at")
    .eq("id", taskId)
    .eq("owner_user_id", user.id)
    .single();

  if (taskError || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userMessage = (body.message ?? "").trim();
  if (!userMessage) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const systemPrompt = `You are a focused work assistant for Tom, owner of Beyond Indigo Pets, a veterinary marketing agency.

You are helping him think through a specific task. Be concise, practical, and action-oriented. Today is ${today}.

Task context:
- Title: ${task.title}
- Status: ${task.status}
- Priority: ${task.priority}
- Due date: ${task.due_date ?? "none"}
- Description: ${task.description ?? "(none)"}
- Notes: ${(task as { notes?: string }).notes ?? "(none)"}

Answer questions, help plan next steps, draft content, or think through blockers for this specific task.`;

  const history: ChatMessage[] = body.history ?? [];
  const messages: Anthropic.Messages.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: userMessage },
  ];

  try {
    const stream = await client.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      system: systemPrompt,
      messages,
    });
    const message = await stream.finalMessage();
    const reply = message.content
      .filter(
        (block): block is Anthropic.Messages.TextBlock =>
          block.type === "text",
      )
      .map((block) => block.text)
      .join("\n")
      .trim();

    return NextResponse.json({ reply });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI request failed" },
      { status: 500 },
    );
  }
}
