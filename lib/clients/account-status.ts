/**
 * Whether we still serve a client. Cancelling and former clients are left off
 * the Response Report's roster (and counted as excluded, never dropped quietly).
 */
export const ACCOUNT_STATUSES = ["active", "cancelling", "former"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  active: "Active",
  cancelling: "Cancelling",
  former: "Former client",
};

export function isAccountStatus(value: unknown): value is AccountStatus {
  return typeof value === "string" && (ACCOUNT_STATUSES as readonly string[]).includes(value);
}

/** Anything unrecognised (or a column not there yet) counts as active: never hide a client by accident. */
export function accountStatusOf(value: unknown): AccountStatus {
  return isAccountStatus(value) ? value : "active";
}

export const ACCOUNT_STATUS_MIGRATION = "supabase/migrations/20261124140000_client_account_status.sql";
