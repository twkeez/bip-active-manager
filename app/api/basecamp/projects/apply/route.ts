import { NextResponse } from "next/server";
import { findDuplicateBasecampProjectAssignments } from "@/lib/clients/basecamp-match";
import { createClient } from "@/lib/supabase/server";
import type { ClientRow } from "@/lib/types/client";

type ApplyBody = {
  updates?: Array<{ clientId: number; basecampProjectId: string }>;
};

function trimProjectId(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ApplyBody;
  try {
    body = (await request.json()) as ApplyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates = Array.isArray(body.updates) ? body.updates : [];
  if (!updates.length) {
    return NextResponse.json({ error: "No updates provided." }, { status: 400 });
  }

  const { data: clientsRaw, error: clientsError } = await supabase
    .from("clients")
    .select("id,account_name,basecamp_project_id");
  if (clientsError) {
    return NextResponse.json({ error: clientsError.message }, { status: 500 });
  }

  const clients = (clientsRaw ?? []) as Pick<
    ClientRow,
    "id" | "account_name" | "basecamp_project_id"
  >[];
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const assignments = findDuplicateBasecampProjectAssignments(
    clients as ClientRow[],
  );

  const applied: Array<{ clientId: number; accountName: string; basecampProjectId: string }> =
    [];
  const skipped: Array<{ clientId: number; reason: string }> = [];

  for (const update of updates) {
    const clientId = Number(update.clientId);
    const projectId = trimProjectId(update.basecampProjectId);
    if (!Number.isInteger(clientId) || clientId <= 0 || !projectId) {
      skipped.push({
        clientId: Number.isFinite(clientId) ? clientId : -1,
        reason: "Invalid client ID or project ID.",
      });
      continue;
    }

    const client = clientById.get(clientId);
    if (!client) {
      skipped.push({ clientId, reason: "Client not found." });
      continue;
    }

    const currentId = trimProjectId(client.basecamp_project_id);
    if (currentId === projectId) {
      skipped.push({ clientId, reason: "Client already has this project ID." });
      continue;
    }

    const assignedClientIds = assignments.get(projectId) ?? [];
    const otherAssignees = assignedClientIds.filter((id) => id !== clientId);
    if (otherAssignees.length > 0) {
      skipped.push({
        clientId,
        reason: `Project ID ${projectId} is already assigned to another client.`,
      });
      continue;
    }

    const { error: updateError } = await supabase
      .from("clients")
      .update({ basecamp_project_id: projectId })
      .eq("id", clientId);
    if (updateError) {
      skipped.push({ clientId, reason: updateError.message });
      continue;
    }

    applied.push({
      clientId,
      accountName: client.account_name,
      basecampProjectId: projectId,
    });

    if (currentId) {
      const oldBucket = assignments.get(currentId) ?? [];
      assignments.set(
        currentId,
        oldBucket.filter((id) => id !== clientId),
      );
    }
    assignments.set(projectId, [clientId]);
    clientById.set(clientId, { ...client, basecamp_project_id: projectId });
  }

  return NextResponse.json({
    ok: true,
    applied: applied.length,
    appliedRows: applied,
    skipped,
  });
}
