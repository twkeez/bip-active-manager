import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveIlluminareBasecampToken } from "@/lib/illuminare/basecamp-client";
import {
  fetchAllBasecampProjects,
  type BasecampProjectSummary,
} from "@/lib/basecamp/client";
import { normalizeClientName } from "@/lib/clients/normalize-name";

/** Fetches all projects from the connected Illuminare Basecamp account. */
export async function listIlluminareBasecampProjects(): Promise<
  BasecampProjectSummary[]
> {
  const admin = createAdminClient();
  const token = await getActiveIlluminareBasecampToken(admin);
  return fetchAllBasecampProjects(
    token.access_token,
    token.account_id,
    normalizeClientName,
  );
}
