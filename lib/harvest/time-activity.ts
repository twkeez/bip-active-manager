import { isClientMarketingTracked } from "@/lib/clients/marketing-tracked";
import { norm } from "@/lib/clients/service-active";
import { fetchAllHarvestPages, fetchHarvestUsersFromAssignments, harvestUserDisplayName, harvestUserFromDisplayName, mergeHarvestUsers } from "@/lib/harvest/client";
import type {
  HarvestConfig,
  HarvestTimeActivityReport,
  HarvestTimeEntry,
  HarvestUser,
  MonthPeriod,
} from "@/lib/harvest/types";
import { getStrategistRoster, type StrategistContact } from "@/lib/team/strategist-roster";
import { toMatchTokens } from "@/lib/dashboard/client-list-utils";
import type { ClientRow } from "@/lib/types/client";

function padMonth(value: number) {
  return String(value).padStart(2, "0");
}

function formatIsoDate(date: Date) {
  return (
    String(date.getFullYear()) +
    "-" +
    padMonth(date.getMonth() + 1) +
    "-" +
    padMonth(date.getDate())
  );
}

export function buildHarvestMonthPeriods(referenceDate = new Date()) {
  const currentStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const previousStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);
  const previousEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 0);

  const previousMonth: MonthPeriod = {
    key: "previous",
    label: previousStart.toLocaleString("en-US", { month: "long", year: "numeric" }),
    from: formatIsoDate(previousStart),
    to: formatIsoDate(previousEnd),
  };

  const currentMonth: MonthPeriod = {
    key: "current",
    label: currentStart.toLocaleString("en-US", { month: "long", year: "numeric" }),
    from: formatIsoDate(currentStart),
    to: formatIsoDate(referenceDate),
  };

  return { previousMonth, currentMonth };
}

function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function expandStrategistAliases(strategist: StrategistContact): StrategistContact[] {
  if (!strategist.name.includes("/")) {
    return [strategist];
  }
  return strategist.name
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((name) => ({ name, email: strategist.email }));
}

export function matchHarvestUsers(
  strategist: StrategistContact,
  users: HarvestUser[],
): HarvestUser[] {
  const matched = new Map<number, HarvestUser>();
  for (const alias of expandStrategistAliases(strategist)) {
    const user = matchHarvestUser(alias, users);
    if (user) matched.set(user.id, user);
  }
  return [...matched.values()];
}

export function matchHarvestUser(
  strategist: StrategistContact,
  users: HarvestUser[],
): HarvestUser | null {
  const email = normalizeEmail(strategist.email);
  if (email) {
    const byEmail = users.find(
      (user) => normalizeEmail(user.email) === email && user.is_active,
    );
    if (byEmail) return byEmail;
  }

  const strategistTokens = toMatchTokens(strategist.name);
  if (strategistTokens.length === 0) return null;

  let best: HarvestUser | null = null;
  let bestScore = 0;

  for (const user of users) {
    if (!user.is_active) continue;
    const nameTokens = toMatchTokens(harvestUserDisplayName(user));
    if (nameTokens.length === 0) continue;

    let score = 0;
    for (const token of strategistTokens) {
      if (nameTokens.some((part) => part.includes(token) || token.includes(part))) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = user;
    }
  }

  return bestScore > 0 ? best : null;
}

function isDateInPeriod(date: string, period: MonthPeriod) {
  return date >= period.from && date <= period.to;
}

export function aggregateHoursByUserAndProject(
  entries: HarvestTimeEntry[],
  previousMonth: MonthPeriod,
  currentMonth: MonthPeriod,
) {
  const hoursByUserPrevious = new Map<number, number>();
  const hoursByUserCurrent = new Map<number, number>();
  const hoursByProjectPrevious = new Map<string, number>();
  const hoursByProjectCurrent = new Map<string, number>();

  for (const entry of entries) {
    const hours = Number(entry.hours) || 0;
    if (hours <= 0) continue;

    const spentDate = entry.spent_date;
    const userId = entry.user?.id;
    const projectId = entry.project?.id != null ? String(entry.project.id) : "";

    if (userId != null) {
      if (isDateInPeriod(spentDate, previousMonth)) {
        hoursByUserPrevious.set(userId, (hoursByUserPrevious.get(userId) ?? 0) + hours);
      }
      if (isDateInPeriod(spentDate, currentMonth)) {
        hoursByUserCurrent.set(userId, (hoursByUserCurrent.get(userId) ?? 0) + hours);
      }
    }

    if (projectId) {
      if (isDateInPeriod(spentDate, previousMonth)) {
        hoursByProjectPrevious.set(
          projectId,
          (hoursByProjectPrevious.get(projectId) ?? 0) + hours,
        );
      }
      if (isDateInPeriod(spentDate, currentMonth)) {
        hoursByProjectCurrent.set(
          projectId,
          (hoursByProjectCurrent.get(projectId) ?? 0) + hours,
        );
      }
    }
  }

  return {
    hoursByUserPrevious,
    hoursByUserCurrent,
    hoursByProjectPrevious,
    hoursByProjectCurrent,
  };
}

export function buildHarvestTimeActivityReport(input: {
  clients: ClientRow[];
  users: HarvestUser[];
  entries: HarvestTimeEntry[];
  referenceDate?: Date;
  strategistRoster?: ReturnType<typeof getStrategistRoster>;
}): HarvestTimeActivityReport {
  const { previousMonth, currentMonth } = buildHarvestMonthPeriods(input.referenceDate);
  const roster = input.strategistRoster ?? getStrategistRoster();
  const aggregates = aggregateHoursByUserAndProject(
    input.entries,
    previousMonth,
    currentMonth,
  );

  const strategists = roster.map((strategist) => {
    const harvestUsers = matchHarvestUsers(strategist, input.users);
    const harvestUserIds = harvestUsers.map((user) => user.id);
    const previousMonthHours = harvestUserIds.reduce(
      (sum, userId) => sum + (aggregates.hoursByUserPrevious.get(userId) ?? 0),
      0,
    );
    const currentMonthHours = harvestUserIds.reduce(
      (sum, userId) => sum + (aggregates.hoursByUserCurrent.get(userId) ?? 0),
      0,
    );
    return {
      name: strategist.name,
      email: strategist.email,
      harvestUserId: harvestUsers[0]?.id ?? null,
      harvestUserName:
        harvestUsers.length > 0
          ? harvestUsers.map((user) => harvestUserDisplayName(user)).join(", ")
          : null,
      matched: harvestUsers.length > 0,
      previousMonthHours,
      currentMonthHours,
    };
  });

  const trackedClients = input.clients.filter((client) => isClientMarketingTracked(client));
  const clientsWithoutHarvestProject = trackedClients
    .filter((client) => !norm(client.harvest_project_id))
    .map((client) => ({
      clientId: client.id,
      accountName: client.account_name,
      marketingStrategist: client.marketing_strategist,
    }))
    .sort((left, right) => left.accountName.localeCompare(right.accountName));

  const clientsWithHarvest = trackedClients.filter((client) =>
    Boolean(norm(client.harvest_project_id)),
  );

  const clientRows = clientsWithHarvest.map((client) => {
    const projectId = norm(client.harvest_project_id);
    return {
      clientId: client.id,
      accountName: client.account_name,
      marketingStrategist: client.marketing_strategist,
      harvestProjectId: projectId,
      previousMonthHours: aggregates.hoursByProjectPrevious.get(projectId) ?? 0,
      currentMonthHours: aggregates.hoursByProjectCurrent.get(projectId) ?? 0,
    };
  });

  const clientsMissingPreviousMonth = clientRows
    .filter((row) => row.previousMonthHours <= 0)
    .sort((left, right) => left.accountName.localeCompare(right.accountName));

  const clientsMissingCurrentMonth = clientRows
    .filter((row) => row.currentMonthHours <= 0)
    .sort((left, right) => left.accountName.localeCompare(right.accountName));

  return {
    fetchedAt: new Date().toISOString(),
    previousMonth,
    currentMonth,
    strategists,
    clientsMissingPreviousMonth,
    clientsMissingCurrentMonth,
    clientsWithoutHarvestProject,
    summary: {
      strategistCount: strategists.length,
      strategistsWithoutCurrentMonthHours: strategists.filter(
        (row) => row.matched && row.currentMonthHours <= 0,
      ).length,
      trackedClientCount: clientsWithHarvest.length,
      clientsMissingPreviousMonthCount: clientsMissingPreviousMonth.length,
      clientsMissingCurrentMonthCount: clientsMissingCurrentMonth.length,
    },
  };
}

export function extractHarvestUsersFromTimeEntries(
  entries: HarvestTimeEntry[],
): HarvestUser[] {
  const byId = new Map<number, HarvestUser>();

  for (const entry of entries) {
    const userId = entry.user?.id;
    const userName = entry.user?.name?.trim();
    if (userId == null || !userName) continue;
    if (byId.has(userId)) continue;
    byId.set(userId, harvestUserFromDisplayName(userId, userName));
  }

  return [...byId.values()].sort((left, right) =>
    harvestUserDisplayName(left).localeCompare(harvestUserDisplayName(right)),
  );
}

export async function fetchHarvestTimeActivityReport(
  config: HarvestConfig,
  clients: ClientRow[],
): Promise<HarvestTimeActivityReport> {
  const { previousMonth, currentMonth } = buildHarvestMonthPeriods();

  const entries = await fetchAllHarvestPages<HarvestTimeEntry>(
    config,
    "/time_entries",
    { from: previousMonth.from, to: currentMonth.to },
    "time_entries",
  );
  const [assignmentUsers, entryUsers] = await Promise.all([
    fetchHarvestUsersFromAssignments(config),
    Promise.resolve(extractHarvestUsersFromTimeEntries(entries)),
  ]);
  const users = mergeHarvestUsers(assignmentUsers, entryUsers);
  const roster = getStrategistRoster();
  const matchPreview = roster.map((strategist) => ({
    name: strategist.name,
    matched: matchHarvestUsers(strategist, users).map((user) => harvestUserDisplayName(user)),
  }));

  return buildHarvestTimeActivityReport({ clients, users, entries });
}
