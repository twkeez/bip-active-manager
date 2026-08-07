import { evaluateClientSetup } from "@/lib/clients/setup-status";
import { seoKeywordAllowance } from "@/lib/playbook/client-tiers";
import { getClientActiveServices, norm } from "@/lib/clients/service-active";
import type {
  ClientActiveServices,
  ClientOnboardingEvaluation,
  ClientOnboardingItem,
  ClientOnboardingTemplate,
  ClientServiceKey,
  ConnectionsHealth,
  DetailTabLink,
  OnboardingCommsCadence,
  OnboardingItemStatus,
  OnboardingPhase,
  OnboardingQueueSummary,
} from "@/lib/clients/types";
import type { BasecampThreadEvent, ClientRow } from "@/lib/types/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export const ONBOARDING_WINDOW_DAYS = 30;
export const COMMS_OVERDUE_DAYS = 7;
export const COMMS_DUE_SOON_DAYS = 5;

export type OnboardingEvaluationContext = {
  socialConnectionCount: number;
  hasSeoBaseline: boolean;
  hasKeywordTargets: boolean;
  hasReportingPrefs: boolean;
  threadEvents: BasecampThreadEvent[];
  /** Onboarding intake signals (absent/null when no intake row exists). */
  webStatus?: string | null;
  websiteLaunchedAt?: string | null;
  websiteLaunchDate?: string | null;
  kickoffMeetingAt?: string | null;
};

// Web statuses where a site build is still coming (so at_launch steps defer).
const LAUNCH_PENDING_WEB_STATUSES = new Set([
  "has_site_rebuild",
  "splash_then_full",
  "wait_for_launch",
  "no_site",
]);

function daysBetween(startIso: string, endDate = new Date()) {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return null;
  return Math.floor((endDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function daysSince(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24));
}

function hasIntakeProfile(client: ClientRow) {
  // Hours are derived from services + tiers, not entered — so the profile just
  // needs the strategist assigned (name + tier come from the pipeline intake).
  return (
    Boolean(norm(client.account_name)) &&
    Boolean(norm(client.marketing_strategist)) &&
    Boolean(norm(client.tier))
  );
}

function hasAnyActiveService(client: ClientRow) {
  return Object.values(getClientActiveServices(client)).some(Boolean);
}

function lastClientTouchpointDays(client: ClientRow) {
  if (!client.last_communication_at) return null;
  if (client.last_event_is_internal) {
    return daysSince(client.last_communication_at);
  }
  return daysSince(client.last_communication_at);
}

function evaluateCommsCadence(
  client: ClientRow,
  onboardingStartedAt: string | null,
): { cadence: OnboardingCommsCadence; label: string } {
  if (client.onboarding_status !== "active" || !onboardingStartedAt) {
    return { cadence: "not_applicable", label: "Not in active onboarding" };
  }
  const daysIn = daysBetween(onboardingStartedAt);
  if (daysIn != null && daysIn > ONBOARDING_WINDOW_DAYS) {
    return { cadence: "not_applicable", label: "Past onboarding window" };
  }

  const sinceClientTouch = lastClientTouchpointDays(client);
  if (sinceClientTouch == null) {
    const sinceStart = daysBetween(onboardingStartedAt);
    if (sinceStart != null && sinceStart >= COMMS_OVERDUE_DAYS) {
      return { cadence: "overdue", label: "No client touchpoint yet (7+ days)" };
    }
    return { cadence: "due_soon", label: "Schedule first client touchpoint" };
  }
  if (sinceClientTouch >= COMMS_OVERDUE_DAYS) {
    return {
      cadence: "overdue",
      label: `No client touchpoint in ${sinceClientTouch} days`,
    };
  }
  if (sinceClientTouch >= COMMS_DUE_SOON_DAYS) {
    return { cadence: "due_soon", label: `Client touchpoint due (${sinceClientTouch} days ago)` };
  }
  return { cadence: "healthy", label: "Client touchpoint within 7 days" };
}

function setupItemDone(setupItemId: string, setupMissingIds: Set<string>) {
  if (!setupMissingIds.has(setupItemId)) return true;
  return false;
}

function actionTabForVerification(verification: string): DetailTabLink | null {
  if (verification.startsWith("setup:")) return "connections";
  if (verification.startsWith("snapshot:keyword") || verification.startsWith("snapshot:reporting")) {
    return "reporting";
  }
  if (verification.startsWith("snapshot:seo")) return "seo";
  if (verification.startsWith("manual:intake")) return "edit";
  if (verification.startsWith("comms:")) return "comms";
  if (verification.startsWith("manual:comms")) return "comms";
  return null;
}

function evaluateAutoItem(
  item: ClientOnboardingItem,
  client: ClientRow,
  ctx: OnboardingEvaluationContext,
  setupMissingIds: Set<string>,
  commsCadence: OnboardingCommsCadence,
  onboardingStartedAt: string | null,
): { done: boolean; hint: string | null } {
  const verification = item.verification;

  if (verification === "manual:record_created") {
    return { done: true, hint: "Client exists in the tool." };
  }

  if (verification === "manual:intake_profile") {
    return hasIntakeProfile(client)
      ? { done: true, hint: null }
      : { done: false, hint: "Fill strategist, tier, and package hours." };
  }

  if (verification === "manual:intake_services") {
    return hasAnyActiveService(client)
      ? { done: true, hint: null }
      : { done: false, hint: "Mark at least one service as active." };
  }

  if (verification.startsWith("setup:")) {
    const setupId = verification.replace("setup:", "");
    const map: Record<string, string> = {
      website: "website",
      basecamp: "basecamp",
      search_console: "search_console",
      google_ads: "google_ads",
      social_connection: "social_connection",
      ga4_property_id: "ga4_property_id",
      google_place_id: "google_place_id",
      harvest: "harvest",
    };
    const key = map[setupId];
    if (!key) return { done: false, hint: null };
    if (key === "harvest") {
      const done =
        setupItemDone("harvest", setupMissingIds) ||
        (!setupMissingIds.has("harvest") &&
          Boolean(norm(client.harvest_project_id)) &&
          Boolean(norm(client.harvest_client_id)));
      return done
        ? { done: true, hint: null }
        : { done: false, hint: "Add Harvest project and client IDs." };
    }
    const services = getClientActiveServices(client);
    if (setupId === "search_console" && !services.seo) {
      return { done: true, hint: "SEO not active — skipped." };
    }
    if (setupId === "google_ads" && !services.ppc) {
      return { done: true, hint: "PPC not active — skipped." };
    }
    if (setupId === "social_connection" && !services.smm) {
      return { done: true, hint: "SMM not active — skipped." };
    }
    if (setupId === "google_place_id" && !services.seo && !services.orm) {
      return { done: true, hint: "SEO/ORM not active — skipped." };
    }
    return setupItemDone(key, setupMissingIds)
      ? { done: true, hint: null }
      : { done: false, hint: "Missing required connection — see Connections tab." };
  }

  if (verification === "comms:weekly_cadence") {
    if (commsCadence === "healthy") return { done: true, hint: null };
    if (commsCadence === "due_soon") {
      return { done: false, hint: "Client touchpoint due soon." };
    }
    if (commsCadence === "overdue") {
      return { done: false, hint: "Overdue — reach out to the client this week." };
    }
    return { done: true, hint: "Outside onboarding comms window." };
  }

  if (verification === "comms:client_reply") {
    if (!onboardingStartedAt) {
      return { done: false, hint: "Waiting for client reply after kickoff." };
    }
    const startedMs = new Date(onboardingStartedAt).getTime();
    const clientReply = ctx.threadEvents.some(
      (event) =>
        !event.is_internal &&
        new Date(event.occurred_at).getTime() >= startedMs,
    );
    if (clientReply) return { done: true, hint: null };
    const externalAfterStart = client.last_communication_at &&
      !client.last_event_is_internal &&
      new Date(client.last_communication_at).getTime() >= startedMs;
    return externalAfterStart
      ? { done: true, hint: null }
      : { done: false, hint: "No client reply recorded since onboarding started." };
  }

  if (verification === "state:kickoff_meeting") {
    return ctx.kickoffMeetingAt
      ? { done: true, hint: null }
      : { done: false, hint: "Enter the kickoff meeting date below." };
  }

  if (verification === "snapshot:seo_baseline") {
    return ctx.hasSeoBaseline
      ? { done: true, hint: null }
      : { done: false, hint: "Run Lighthouse or an SEO crawl." };
  }
  if (verification === "snapshot:keyword_targets") {
    if (seoKeywordAllowance(client) === 0) {
      return { done: true, hint: "No keyword tracking at this tier." };
    }
    return ctx.hasKeywordTargets
      ? { done: true, hint: null }
      : { done: false, hint: "Suggest and save the tracked keywords below." };
  }
  if (verification === "snapshot:reporting_prefs") {
    return ctx.hasReportingPrefs
      ? { done: true, hint: null }
      : { done: false, hint: "Save reporting metric preferences." };
  }

  return { done: false, hint: null };
}

export function evaluateOnboardingItemStatus(
  item: ClientOnboardingItem,
  client: ClientRow,
  ctx: OnboardingEvaluationContext,
  setupMissingIds: Set<string>,
  commsCadence: OnboardingCommsCadence,
  onboardingStartedAt: string | null,
  deferred = false,
): OnboardingItemStatus {
  // These "manual:" verifications actually auto-verify from client data
  // (record exists, profile filled, services set) — no checkbox needed.
  const autoVerifiedManual = new Set([
    "manual:record_created",
    "manual:intake_profile",
    "manual:intake_services",
  ]);
  const isManual = item.verification.startsWith("manual:") && !autoVerifiedManual.has(item.verification);
  let done = Boolean(item.completed_at);
  let autoVerified = false;
  let hint: string | null = null;

  if (isManual) {
    if (!done) {
      hint = item.notes ?? "Mark complete when done.";
    }
  } else {
    const auto = evaluateAutoItem(
      item,
      client,
      ctx,
      setupMissingIds,
      commsCadence,
      onboardingStartedAt,
    );
    done = auto.done;
    autoVerified = auto.done;
    hint = auto.hint;
  }

  return {
    itemKey: item.item_key,
    label: item.label,
    category: item.category,
    severity: item.severity,
    verification: item.verification,
    sortOrder: item.sort_order,
    requiredForGraduation: item.required_for_graduation,
    phase: item.phase,
    deferred,
    done,
    autoVerified,
    hint,
    guidance: item.guidance,
    completedAt: item.completed_at,
    notes: item.notes,
    actionTab: actionTabForVerification(item.verification),
  };
}

// The connections relevant to a client (by service) and whether each is in.
// Rendered as a red/yellow/green light instead of onboarding steps.
export function computeConnectionsHealth(
  client: ClientRow,
  socialConnectionCount: number,
): ConnectionsHealth {
  const services = getClientActiveServices(client);
  const has = (v: string | null | undefined) => Boolean((v ?? "").trim());
  const items: Array<{ label: string; connected: boolean }> = [
    { label: "Website", connected: has(client.website) },
    { label: "Basecamp", connected: has(client.basecamp_project_id) },
  ];
  if (services.seo) {
    items.push({ label: "Search Console", connected: has(client.sc_url) });
    items.push({ label: "GA4", connected: has(client.ga4_property_id) });
  }
  if (services.seo || services.orm) {
    items.push({ label: "Google Business Profile", connected: has(client.google_place_id) });
  }
  if (services.ppc) items.push({ label: "Google Ads", connected: has(client.ads_customer_id) });
  if (services.smm) items.push({ label: "Social", connected: socialConnectionCount > 0 });

  const connected = items.filter((i) => i.connected).length;
  const total = items.length;
  const status: ConnectionsHealth["status"] =
    total === 0 || connected === total ? "green" : connected === 0 ? "red" : "yellow";
  return { status, connected, total, items };
}

export function evaluateClientOnboarding(
  client: ClientRow,
  items: ClientOnboardingItem[],
  ctx: OnboardingEvaluationContext,
): ClientOnboardingEvaluation {
  const setup = evaluateClientSetup(client, {
    socialConnectionCount: ctx.socialConnectionCount,
  });
  const setupMissingIds = new Set([
    ...setup.missingRequired.map((row) => row.id),
    ...setup.missingRecommended.map((row) => row.id),
  ]);

  const { cadence: commsCadence, label: commsCadenceLabel } = evaluateCommsCadence(
    client,
    client.onboarding_started_at,
  );

  // Launch phasing: at_launch steps are deferred while a build is pending and
  // the site hasn't been marked launched. Clients with no intake row (legacy)
  // or a kept existing site have nothing pending → nothing defers.
  const launchPending = ctx.webStatus != null && LAUNCH_PENDING_WEB_STATUSES.has(ctx.webStatus);
  const launched = ctx.websiteLaunchedAt != null;
  const deferAtLaunch = launchPending && !launched;

  const evaluatedItems = [...items]
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    .map((item) =>
      evaluateOnboardingItemStatus(
        item,
        client,
        ctx,
        setupMissingIds,
        commsCadence,
        client.onboarding_started_at,
        deferAtLaunch && item.phase === "at_launch",
      ),
    );

  // Progress + graduation only count the currently-active phase (deferred
  // at_launch steps don't drag down foundation progress).
  const activeItems = evaluatedItems.filter((item) => !item.deferred);
  const graduationItems = activeItems.filter((item) => item.requiredForGraduation);
  const requiredDoneCount = graduationItems.filter((item) => item.done).length;
  const requiredTotalCount = graduationItems.length;
  const progressPercent =
    requiredTotalCount === 0
      ? 100
      : Math.round((requiredDoneCount / requiredTotalCount) * 100);

  // Honest per-phase required-step counts for display. Unlike progressPercent
  // (which intentionally ignores deferred steps for gating), these count every
  // required step by phase so the UI can show "Foundation x/y · Launch a/b" and
  // never claim 100% while launch work remains.
  const requiredByPhase = (phase: OnboardingPhase) =>
    evaluatedItems.filter((item) => item.phase === phase && item.requiredForGraduation);
  const foundationRequired = requiredByPhase("foundation");
  const launchRequired = requiredByPhase("at_launch");
  const foundationRequiredDoneCount = foundationRequired.filter((item) => item.done).length;
  const foundationRequiredTotalCount = foundationRequired.length;
  const launchRequiredDoneCount = launchRequired.filter((item) => item.done).length;
  const launchRequiredTotalCount = launchRequired.length;

  // Missing at_launch connections aren't a "block" while they're deferred.
  const setupBlocked = !deferAtLaunch && setup.missingRequired.length > 0;
  const foundationComplete =
    requiredTotalCount === 0 || requiredDoneCount === requiredTotalCount;
  // Can't finish onboarding while a launch is still pending — the launch
  // milestone (and its steps) must come first.
  const readyToGraduate =
    client.onboarding_status === "active" &&
    foundationComplete &&
    !setupBlocked &&
    !deferAtLaunch;

  let urgencyScore = 0;
  if (client.onboarding_status === "active") {
    if (commsCadence === "overdue") urgencyScore += 40;
    else if (commsCadence === "due_soon") urgencyScore += 20;
    if (setupBlocked) urgencyScore += 30;
    urgencyScore += Math.min(30, setup.missingRequired.length * 10);
    const daysIn = client.onboarding_started_at
      ? daysBetween(client.onboarding_started_at) ?? 0
      : 0;
    urgencyScore += Math.min(20, daysIn);
    if (readyToGraduate) urgencyScore += 5;
  }

  return {
    clientId: client.id,
    accountName: client.account_name,
    marketingStrategist: client.marketing_strategist,
    onboardingStatus: client.onboarding_status,
    onboardingStartedAt: client.onboarding_started_at,
    onboardingCompletedAt: client.onboarding_completed_at,
    onboardingTargetDate: client.onboarding_target_date,
    daysInOnboarding: client.onboarding_started_at
      ? daysBetween(client.onboarding_started_at)
      : null,
    items: evaluatedItems,
    progressPercent,
    requiredDoneCount,
    requiredTotalCount,
    foundationRequiredDoneCount,
    foundationRequiredTotalCount,
    launchRequiredDoneCount,
    launchRequiredTotalCount,
    setupBlocked,
    commsCadence,
    commsCadenceLabel,
    readyToGraduate,
    urgencyScore,
    launchPending,
    launched,
    foundationComplete,
    websiteLaunchDate: ctx.websiteLaunchDate ?? null,
    connectionsHealth: computeConnectionsHealth(client, ctx.socialConnectionCount),
  };
}

export function summarizeOnboardingQueue(
  evaluations: ClientOnboardingEvaluation[],
): OnboardingQueueSummary {
  const active = evaluations.filter((row) => row.onboardingStatus === "active");
  return {
    inOnboarding: active.length,
    setupBlocked: active.filter((row) => row.setupBlocked).length,
    commsOverdue: active.filter((row) => row.commsCadence === "overdue").length,
    readyToGraduate: active.filter((row) => row.readyToGraduate).length,
  };
}

export async function listOnboardingTemplates(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("client_onboarding_templates")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ClientOnboardingTemplate[];
}

export async function listClientOnboardingItems(
  supabase: SupabaseClient,
  clientId: number,
) {
  const { data, error } = await supabase
    .from("client_onboarding_items")
    .select("*")
    .eq("client_id", clientId)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ClientOnboardingItem[];
}

/**
 * Filters template items down to those that apply to a client's purchased
 * services: an item with no `requires_service` always applies; a service-tagged
 * item applies only when that service is active.
 */
export function templatesForServices<
  T extends { requires_service: ClientServiceKey | null },
>(templates: T[], activeServices: ClientActiveServices): T[] {
  return templates.filter(
    (template) => !template.requires_service || activeServices[template.requires_service],
  );
}

export async function startOnboardingForClient(
  supabase: SupabaseClient,
  clientId: number,
  userId: string,
) {
  const templates = await listOnboardingTemplates(supabase);
  if (!templates.length) {
    throw new Error("No onboarding template items configured.");
  }

  const now = new Date().toISOString();

  // Load the client so we only seed items for the services they actually bought.
  const { data: clientRow, error: loadError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();
  if (loadError) throw new Error(loadError.message);
  if (!clientRow) throw new Error("Client not found.");
  const activeServices = getClientActiveServices(clientRow as ClientRow);

  const { error: clientError } = await supabase
    .from("clients")
    .update({
      onboarding_status: "active",
      onboarding_started_at: now,
      onboarding_completed_at: null,
    })
    .eq("id", clientId);
  if (clientError) throw new Error(clientError.message);

  const { data: existingItems } = await supabase
    .from("client_onboarding_items")
    .select("id")
    .eq("client_id", clientId)
    .limit(1);

  if (!existingItems?.length) {
    const applicable = templatesForServices(templates, activeServices);
    const rows = applicable.map((template) => ({
      client_id: clientId,
      item_key: template.item_key,
      label: template.label,
      category: template.category,
      severity: template.severity,
      verification: template.verification,
      sort_order: template.sort_order,
      required_for_graduation: template.required_for_graduation,
      phase: template.phase,
      requires_service: template.requires_service,
      guidance: template.guidance,
      completed_at:
        template.verification === "manual:record_created" ? now : null,
      completed_by:
        template.verification === "manual:record_created" ? userId : null,
      updated_at: now,
    }));
    const { error: insertError } = await supabase
      .from("client_onboarding_items")
      .insert(rows);
    if (insertError) throw new Error(insertError.message);
  } else {
    const { error: resetError } = await supabase
      .from("clients")
      .update({
        onboarding_status: "active",
        onboarding_started_at: now,
        onboarding_completed_at: null,
      })
      .eq("id", clientId);
    if (resetError) throw new Error(resetError.message);
  }

  return { startedAt: now };
}

// Reconcile a client's onboarding items with their currently-active services:
// add steps for services turned on, remove steps for services turned off. Runs
// when services change mid-onboarding so the wizard reflects it immediately.
export async function syncOnboardingItemsToServices(
  supabase: SupabaseClient,
  clientId: number,
) {
  const { data: clientRow } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();
  if (!clientRow) return;
  const client = clientRow as ClientRow;
  if (client.onboarding_status !== "active") return;

  const activeServices = getClientActiveServices(client);
  const templates = await listOnboardingTemplates(supabase);
  const { data: existingRows } = await supabase
    .from("client_onboarding_items")
    .select("item_key")
    .eq("client_id", clientId);
  const existingKeys = new Set((existingRows ?? []).map((r) => (r as { item_key: string }).item_key));

  const applies = (t: ClientOnboardingTemplate) =>
    !t.requires_service || activeServices[t.requires_service];

  const toRemove = templates
    .filter((t) => t.requires_service && !activeServices[t.requires_service] && existingKeys.has(t.item_key))
    .map((t) => t.item_key);
  if (toRemove.length > 0) {
    await supabase
      .from("client_onboarding_items")
      .delete()
      .eq("client_id", clientId)
      .in("item_key", toRemove);
  }

  const now = new Date().toISOString();
  const toAdd = templates
    .filter((t) => applies(t) && !existingKeys.has(t.item_key))
    .map((t) => ({
      client_id: clientId,
      item_key: t.item_key,
      label: t.label,
      category: t.category,
      severity: t.severity,
      verification: t.verification,
      sort_order: t.sort_order,
      required_for_graduation: t.required_for_graduation,
      phase: t.phase,
      requires_service: t.requires_service,
      guidance: t.guidance,
      completed_at: t.verification === "manual:record_created" ? now : null,
      updated_at: now,
    }));
  if (toAdd.length > 0) {
    await supabase.from("client_onboarding_items").insert(toAdd);
  }
}

export async function completeOnboardingForClient(
  supabase: SupabaseClient,
  clientId: number,
  evaluation: ClientOnboardingEvaluation,
) {
  if (!evaluation.readyToGraduate) {
    throw new Error("Required onboarding steps are not complete yet.");
  }
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("clients")
    .update({
      onboarding_status: "complete",
      onboarding_completed_at: now,
    })
    .eq("id", clientId);
  if (error) throw new Error(error.message);
  return { completedAt: now };
}

export async function patchOnboardingItem(
  supabase: SupabaseClient,
  clientId: number,
  itemKey: string,
  params: { done?: boolean; notes?: string | null },
  userId: string,
) {
  const { data: itemRaw, error: fetchError } = await supabase
    .from("client_onboarding_items")
    .select("*")
    .eq("client_id", clientId)
    .eq("item_key", itemKey)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!itemRaw) throw new Error("Onboarding item not found.");

  const item = itemRaw as ClientOnboardingItem;
  if (!item.verification.startsWith("manual:")) {
    throw new Error("Only manual checklist items can be updated directly.");
  }
  if (item.verification === "manual:record_created") {
    throw new Error("This item is auto-completed.");
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  if (Object.prototype.hasOwnProperty.call(params, "notes")) {
    patch.notes = params.notes ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(params, "done")) {
    patch.completed_at = params.done ? now : null;
    patch.completed_by = params.done ? userId : null;
  }

  const { data: updated, error } = await supabase
    .from("client_onboarding_items")
    .update(patch)
    .eq("client_id", clientId)
    .eq("item_key", itemKey)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return updated as ClientOnboardingItem;
}

export async function buildOnboardingContextForClients(
  supabase: SupabaseClient,
  userId: string,
  clientIds: number[],
): Promise<Record<number, OnboardingEvaluationContext>> {
  if (!clientIds.length) return {};

  const uniqueIds = [...new Set(clientIds)];

  const [
    socialRes,
    lighthouseRes,
    crawlRes,
    keywordRes,
    prefsRes,
    threadsRes,
    intakeRes,
  ] = await Promise.all([
    supabase
      .from("client_social_connections")
      .select("client_id")
      .in("client_id", uniqueIds)
      .eq("is_active", true),
    supabase
      .from("client_lighthouse_snapshots")
      .select("client_id")
      .in("client_id", uniqueIds),
    supabase.from("client_seo_crawl_snapshots").select("client_id").in("client_id", uniqueIds),
    supabase
      .from("client_keyword_targets")
      .select("client_id")
      .eq("owner_user_id", userId)
      .in("client_id", uniqueIds),
    supabase
      .from("client_reporting_metric_preferences")
      .select("client_id")
      .eq("owner_user_id", userId)
      .in("client_id", uniqueIds),
    supabase
      .from("basecamp_communication_events")
      .select("*")
      .in("client_id", uniqueIds)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("client_onboarding_intake")
      .select("client_id, web_status, website_launched_at, website_launch_date, kickoff_meeting_at")
      .in("client_id", uniqueIds),
  ]);

  const socialCounts: Record<number, number> = {};
  for (const row of socialRes.data ?? []) {
    const id = (row as { client_id: number }).client_id;
    socialCounts[id] = (socialCounts[id] ?? 0) + 1;
  }

  const seoBaseline = new Set<number>();
  for (const row of lighthouseRes.data ?? []) {
    seoBaseline.add((row as { client_id: number }).client_id);
  }
  for (const row of crawlRes.data ?? []) {
    seoBaseline.add((row as { client_id: number }).client_id);
  }

  const keywordClients = new Set(
    (keywordRes.data ?? []).map((row) => (row as { client_id: number }).client_id),
  );
  const prefsClients = new Set(
    (prefsRes.data ?? []).map((row) => (row as { client_id: number }).client_id),
  );

  const threadsByClient: Record<number, BasecampThreadEvent[]> = {};
  for (const row of (threadsRes.data ?? []) as BasecampThreadEvent[]) {
    if (!threadsByClient[row.client_id]) threadsByClient[row.client_id] = [];
    threadsByClient[row.client_id]!.push(row);
  }

  const intakeByClient: Record<
    number,
    {
      web_status: string | null;
      website_launched_at: string | null;
      website_launch_date: string | null;
      kickoff_meeting_at: string | null;
    }
  > = {};
  for (const row of (intakeRes.data ?? []) as Array<{
    client_id: number;
    web_status: string | null;
    website_launched_at: string | null;
    website_launch_date: string | null;
    kickoff_meeting_at: string | null;
  }>) {
    intakeByClient[row.client_id] = {
      web_status: row.web_status,
      website_launched_at: row.website_launched_at,
      website_launch_date: row.website_launch_date,
      kickoff_meeting_at: row.kickoff_meeting_at,
    };
  }

  const ctx: Record<number, OnboardingEvaluationContext> = {};
  for (const clientId of uniqueIds) {
    const intake = intakeByClient[clientId];
    ctx[clientId] = {
      socialConnectionCount: socialCounts[clientId] ?? 0,
      hasSeoBaseline: seoBaseline.has(clientId),
      hasKeywordTargets: keywordClients.has(clientId),
      hasReportingPrefs: prefsClients.has(clientId),
      threadEvents: threadsByClient[clientId] ?? [],
      webStatus: intake?.web_status ?? null,
      websiteLaunchedAt: intake?.website_launched_at ?? null,
      websiteLaunchDate: intake?.website_launch_date ?? null,
      kickoffMeetingAt: intake?.kickoff_meeting_at ?? null,
    };
  }
  return ctx;
}

export const ONBOARDING_CATEGORY_LABELS: Record<
  ClientOnboardingEvaluation["items"][number]["category"],
  string
> = {
  intake: "Intake",
  connections: "Connections",
  communication: "Communication",
  launch: "Launch",
};

export async function buildOnboardingEvaluations(
  supabase: SupabaseClient,
  userId: string,
  clients: ClientRow[],
): Promise<ClientOnboardingEvaluation[]> {
  const clientIds = clients.map((client) => client.id);
  const [ctxByClient, itemsByClient] = await Promise.all([
    buildOnboardingContextForClients(supabase, userId, clientIds),
    Promise.all(
      clientIds.map(async (clientId) => ({
        clientId,
        items: await listClientOnboardingItems(supabase, clientId),
      })),
    ),
  ]);

  const itemsMap = new Map(itemsByClient.map((row) => [row.clientId, row.items]));

  return clients.map((client) =>
    evaluateClientOnboarding(
      client,
      itemsMap.get(client.id) ?? [],
      ctxByClient[client.id] ?? {
        socialConnectionCount: 0,
        hasSeoBaseline: false,
        hasKeywordTargets: false,
        hasReportingPrefs: false,
        threadEvents: [],
        webStatus: null,
        websiteLaunchedAt: null,
        websiteLaunchDate: null,
      },
    ),
  );
}
