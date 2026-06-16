export type HarvestConfig = {
  accessToken: string;
  accountId: string;
  userAgent: string;
};

export type HarvestUser = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
  display_name?: string;
};

export type HarvestUserAssignment = {
  user: { id: number; name: string };
};

export type HarvestTimeEntry = {
  id: number;
  hours: number;
  spent_date: string;
  user: { id: number; name: string };
  project: { id: number; name: string };
};

export type MonthPeriod = {
  key: string;
  label: string;
  from: string;
  to: string;
};

export type StrategistTimeRow = {
  name: string;
  email: string | null;
  harvestUserId: number | null;
  harvestUserName: string | null;
  matched: boolean;
  previousMonthHours: number;
  currentMonthHours: number;
};

export type ClientTimeRow = {
  clientId: number;
  accountName: string;
  marketingStrategist: string | null;
  harvestProjectId: string;
  previousMonthHours: number;
  currentMonthHours: number;
};

export type HarvestTimeActivityReport = {
  fetchedAt: string;
  previousMonth: MonthPeriod;
  currentMonth: MonthPeriod;
  strategists: StrategistTimeRow[];
  clientsMissingPreviousMonth: ClientTimeRow[];
  clientsMissingCurrentMonth: ClientTimeRow[];
  clientsWithoutHarvestProject: Array<{
    clientId: number;
    accountName: string;
    marketingStrategist: string | null;
  }>;
  summary: {
    strategistCount: number;
    strategistsWithoutCurrentMonthHours: number;
    trackedClientCount: number;
    clientsMissingPreviousMonthCount: number;
    clientsMissingCurrentMonthCount: number;
  };
};
