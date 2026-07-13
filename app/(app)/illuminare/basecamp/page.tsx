import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listIlluminareBasecampProjects } from "@/lib/illuminare/basecamp-projects";
import {
  matchIlluminareProjects,
  type IlluminareProjectMatch,
} from "@/lib/illuminare/basecamp-match";
import type { BasecampProjectSummary } from "@/lib/basecamp/client";
import IlluminareBasecampMatch from "@/components/illuminare/illuminare-basecamp-match";

export default async function IlluminareBasecampPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: clientsData } = await supabase
    .from("illuminare_clients")
    .select("id, account_name, basecamp_project_id")
    .order("account_name", { ascending: true });
  const clients = (clientsData ?? []) as {
    id: number;
    account_name: string;
    basecamp_project_id: string | null;
  }[];

  let projects: BasecampProjectSummary[] = [];
  let matches: IlluminareProjectMatch[] = [];
  let unmatched: BasecampProjectSummary[] = [];
  let loadError: string | null = null;
  try {
    projects = await listIlluminareBasecampProjects();
    const result = matchIlluminareProjects(clients, projects);
    matches = result.matches;
    unmatched = result.unmatchedProjects;
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Failed to load projects";
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <Link
        href="/illuminare"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        <ArrowLeft size={14} /> Illuminare
      </Link>

      <header className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--text)]">
          Basecamp project matching
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Link each client to its Basecamp project so comms can be pulled in.
        </p>
      </header>

      <IlluminareBasecampMatch
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        matches={matches}
        unmatched={unmatched.map((p) => ({ id: p.id, name: p.name }))}
        loadError={loadError}
      />
    </div>
  );
}
