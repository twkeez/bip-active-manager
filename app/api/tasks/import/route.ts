import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listTaskCategories, validateCategoryName } from "@/lib/tasks/categories";
import { parseLegacyTasksFromRaw } from "@/lib/tasks/import";
import type { UserTaskCategory, UserTaskPerson } from "@/lib/types/client";

type ImportBody = {
  rawText?: string;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim();
}

function looksLikeWatchTitle(title: string) {
  return /^watch:\s+/i.test(title);
}

function extractClientNameFromWatchTitle(title: string) {
  if (!looksLikeWatchTitle(title)) return null;
  return normalize(title.replace(/^watch:\s+/i, "")) || null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ImportBody;
  try {
    body = (await request.json()) as ImportBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawText = normalize(body.rawText);
  if (!rawText) {
    return NextResponse.json({ error: "rawText is required" }, { status: 400 });
  }

  const rows = parseLegacyTasksFromRaw(rawText);
  if (!rows.length) {
    return NextResponse.json(
      { error: "No valid rows found in pasted table" },
      { status: 400 },
    );
  }

  const [{ data: peopleRaw }, { data: clientsRaw }] = await Promise.all([
    supabase
      .from("user_task_people")
      .select("*")
      .eq("owner_user_id", user.id)
      .order("name", { ascending: true }),
    supabase
      .from("clients")
      .select("id,account_name")
      .order("account_name", { ascending: true }),
  ]);

  const categories = await listTaskCategories(supabase, user.id);
  const categoriesByLower = new Map<string, UserTaskCategory>();
  for (const category of categories) {
    categoriesByLower.set(category.name.trim().toLowerCase(), category);
  }

  const people = (peopleRaw ?? []) as UserTaskPerson[];
  const peopleByLower = new Map<string, UserTaskPerson>();
  for (const person of people) {
    peopleByLower.set(person.name.trim().toLowerCase(), person);
  }

  const clientNameToId = new Map<string, number>();
  for (const client of (clientsRaw ?? []) as Array<{ id: number; account_name: string }>) {
    clientNameToId.set(client.account_name.trim().toLowerCase(), client.id);
  }

  const nowIso = new Date().toISOString();
  const errors: string[] = [];
  let imported = 0;

  for (const [index, row] of rows.entries()) {
    try {
      let categoryId: number | null = null;
      if (row.categoryName) {
        const validation = validateCategoryName(row.categoryName);
        if (validation.valid) {
          const key = validation.name.toLowerCase();
          let category = categoriesByLower.get(key) ?? null;
          if (!category) {
            const { data: insertedCategoryRaw, error: insertCategoryError } = await supabase
              .from("user_task_categories")
              .insert({
                owner_user_id: user.id,
                name: validation.name,
                created_at: nowIso,
                updated_at: nowIso,
              })
              .select("*")
              .single();
            if (!insertCategoryError && insertedCategoryRaw) {
              category = insertedCategoryRaw as UserTaskCategory;
              categories.push(category);
              categoriesByLower.set(key, category);
            }
          }
          categoryId = category?.id ?? null;
        }
      }

      let clientId: number | null = null;
      const watchClient = extractClientNameFromWatchTitle(row.title);
      if (watchClient) {
        clientId = clientNameToId.get(watchClient.toLowerCase()) ?? null;
      }

      const descriptionParts = [row.description];
      if (row.communicationPreview) {
        descriptionParts.push(`Preview: ${row.communicationPreview}`);
      }
      const description = descriptionParts
        .map((value) => normalize(value))
        .filter(Boolean)
        .join("\n\n");

      const { data: taskRaw, error: taskError } = await supabase
        .from("user_tasks")
        .insert({
          owner_user_id: user.id,
          title: row.title,
          notes: null,
          description: description || null,
          status: row.status,
          priority: row.priority,
          due_date: row.dueDate,
          category_id: categoryId,
          client_id: clientId,
          is_starred: row.isStarred,
          source_type: "manual",
          created_at: row.createdAt ?? nowIso,
          updated_at: row.updatedAt ?? nowIso,
        })
        .select("id")
        .single();
      if (taskError || !taskRaw) {
        throw new Error(taskError?.message ?? "Failed to insert task");
      }

      const taskId = Number(taskRaw.id);

      if (row.assigneeName) {
        const personKey = row.assigneeName.toLowerCase();
        let person = peopleByLower.get(personKey) ?? null;
        if (!person) {
          const { data: insertedPersonRaw, error: insertPersonError } = await supabase
            .from("user_task_people")
            .insert({
              owner_user_id: user.id,
              name: row.assigneeName,
              created_at: nowIso,
              updated_at: nowIso,
            })
            .select("*")
            .single();
          if (!insertPersonError && insertedPersonRaw) {
            person = insertedPersonRaw as UserTaskPerson;
            peopleByLower.set(personKey, person);
          }
        }
        if (person) {
          await supabase.from("user_task_assignees").insert({
            owner_user_id: user.id,
            task_id: taskId,
            person_id: person.id,
            created_at: nowIso,
          });
        }
      }

      if (row.basecampUrl) {
        await supabase.from("user_task_links").insert({
          owner_user_id: user.id,
          task_id: taskId,
          label: row.basecampSubject || "Basecamp thread",
          url: row.basecampUrl,
          created_at: nowIso,
          updated_at: nowIso,
        });
      }

      imported += 1;
    } catch (error) {
      errors.push(
        `Row ${index + 2} (${row.title}): ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  return NextResponse.json({
    imported,
    attempted: rows.length,
    errors,
  });
}
