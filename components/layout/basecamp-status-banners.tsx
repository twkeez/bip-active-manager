import type { BasecampSyncState } from "@/lib/types/client";
type BasecampStatusBannersProps = {
  basecampStatus?: string;
  syncState?: BasecampSyncState | null;
  syncError?: string | null;
  syncSuccess?: string | null;
};
export default function BasecampStatusBanners({
  basecampStatus,
  syncState,
  syncError,
  syncSuccess,
}: BasecampStatusBannersProps) {
  const hasContent =
    basecampStatus === "connected" ||
    syncError ||
    syncSuccess ||
    syncState?.last_error ||
    (basecampStatus &&
      basecampStatus !== "connected" &&
      ![
        "oauth_state_error",
        "classic_auth_mode",
        "missing_oauth_env",
        "oauth_config_error",
        "forbidden",
      ].includes(basecampStatus)) ||
    basecampStatus === "oauth_state_error" ||
    basecampStatus === "missing_oauth_env";
  if (!hasContent) return null;
  return (
    <div className="mb-5 space-y-2">
      
      {basecampStatus === "connected" ? (
        <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          
          Basecamp connected successfully.
        </p>
      ) : null}
      {basecampStatus &&
      basecampStatus !== "connected" &&
      ![
        "oauth_state_error",
        "classic_auth_mode",
        "missing_oauth_env",
        "oauth_config_error",
        "forbidden",
      ].includes(basecampStatus) ? (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          
          Basecamp OAuth error: {basecampStatus}
        </p>
      ) : null}
      {basecampStatus === "oauth_state_error" ? (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          
          Basecamp OAuth state mismatch. Please try connecting again.
        </p>
      ) : null}
      {basecampStatus === "missing_oauth_env" ? (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          
          OAuth connect requires{""}
          <code className="rounded bg-amber-500/20 px-1 py-0.5 text-xs">
            BASECAMP_CLIENT_ID
          </code>
          and{""}
          <code className="rounded bg-amber-500/20 px-1 py-0.5 text-xs">
            BASECAMP_CLIENT_SECRET
          </code>
          in{""}
          <code className="rounded bg-amber-500/20 px-1 py-0.5 text-xs">
            .env.local
          </code>
          , then restart the dev server.
        </p>
      ) : null}
      {syncState?.last_error ? (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          
          Last sync error: {syncState.last_error}
        </p>
      ) : null}
      {syncError ? (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          
          {syncError}
        </p>
      ) : null}
      {syncSuccess ? (
        <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          
          {syncSuccess}
        </p>
      ) : null}
    </div>
  );
}
