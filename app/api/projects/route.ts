import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  batchProjectMeta,
  fetchProjectClient,
} from "@/lib/projects/access";
import {
  isClientProjectStatus,
  normalizeProjectDate,
  normalizeProjectName,
  normalizeProjectText,
} from "@/lib/projects/shared";
import type {
  ClientProject,
  ClientProjectWithMeta,
  TaskClientOption,
} from "@/lib/types/client";

type CreateProjectBody = {
  clientId?: number | null;
  name?: string;
  description?: string | null;
  objective?: string | null;
  status?: ClientProject["status"];
  targetStartDate?: string | null;
  targetEndDate?: string | null;
};

async function enrichProjects(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  projects: ClientProject[],
  clientsById: Map<number, TaskClientOption>,
): Promise<ClientProjectWithMeta[]> {
  const { phasesByProject, openTaskCountByProject } = await batchProjectMeta(
    supabase,
    userId,
    projects.map((project) => project.id),
  );

  return projects.map((project) => {
    const phases = phasesByProject.get(project.id) ?? [];
    const client = project.client_id != null ? clientsById.get(project.client_id) ?? null : null;
    return {
      ...project,
      client,
      phases,
      phaseDoneCount: phases.filter((phase) => phase.status === "done").length,
      phaseTotalCount: phases.length,
      openTaskCount: openTaskCountByProject.get(project.id) ?? 0,
    };
  });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const clientIdParam = url.searchParams.get("clientId");
  const statusParam = url.searchParams.get("status");

  let query = supabase
    .from("client_projects")
    .select("*")
    .eq("owner_user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (clientIdParam === "internal") {
    query = query.is("client_id", null);
  } else if (clientIdParam) {
    const clientId = Number(clientIdParam);
    if (!Number.isInteger(clientId) || clientId <= 0) {
      return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
    }
    query = query.eq("client_id", clientId);
  }
  if (statusParam) {
    if (!isClientProjectStatus(statusParam)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    query = query.eq("status", statusParam);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const projects = (data ?? []) as ClientProject[];
  const clientIds = [
    ...new Set(
      projects
        .map((project) => project.client_id)
        .filter((id): id is number => id != null),
    ),
  ];
  const { data: clientsRaw } = clientIds.length
    ? await supabase
        .from("clients")
        .select("id,account_name")
        .in("id", clientIds)
    : { data: [] };
  const clientsById = new Map(
    ((clientsRaw ?? []) as TaskClientOption[]).map((client) => [client.id, client]),
  );

  const enriched = await enrichProjects(supabase, user.id, projects, clientsById);
  return NextResponse.json({ projects: enriched });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateProjectBody;
  try {
    body = (await request.json()) as CreateProjectBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const hasClientId = Object.prototype.hasOwnProperty.call(body, "clientId");
  let clientId: number | null = null;
  if (hasClientId) {
    if (body.clientId == null) {
      clientId = null;
    } else {
      clientId = Number(body.clientId);
      if (!Number.isInteger(clientId) || clientId <= 0) {
        return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
      }
      const { data: clientRow } = await supabase
        .from("clients")
        .select("id")
        .eq("id", clientId)
        .maybeSingle();
      if (!clientRow) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }
    }
  } else {
    return NextResponse.json({ error: "clientId is required (use null for internal)" }, { status: 400 });
  }

  const name = normalizeProjectName(body.name);
  if (!name) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  }

  const status = body.status ?? "draft";
  if (!isClientProjectStatus(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const targetStartDate = normalizeProjectDate(body.targetStartDate);
  const targetEndDate = normalizeProjectDate(body.targetEndDate);
  if (body.targetStartDate != null && !targetStartDate) {
    return NextResponse.json({ error: "Invalid targetStartDate" }, { status: 400 });
  }
  if (body.targetEndDate != null && !targetEndDate) {
    return NextResponse.json({ error: "Invalid targetEndDate" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const { data: inserted, error } = await supabase
    .from("client_projects")
    .insert({
      owner_user_id: user.id,
      client_id: clientId,
      name,
      description: normalizeProjectText(body.description),
      objective: normalizeProjectText(body.objective),
      status,
      target_start_date: targetStartDate,
      target_end_date: targetEndDate,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("*")
    .single();
  if (error || !inserted) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create project" },
      { status: 500 },
    );
  }

  const project = inserted as ClientProject;
  const client = await fetchProjectClient(supabase, clientId);
  const enriched: ClientProjectWithMeta = {
    ...project,
    client,
    phases: [],
    phaseDoneCount: 0,
    phaseTotalCount: 0,
    openTaskCount: 0,
  };
  return NextResponse.json({ project: enriched });
}
