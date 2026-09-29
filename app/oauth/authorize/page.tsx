import { redirect } from "next/navigation";
import { POOBAH_NAME } from "@/lib/poobah/types";
import { decide } from "./actions";
import { AUTHORIZE_PARAMS, checkAuthorize } from "./logic";

export const dynamic = "force-dynamic";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bip-page p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-bip-border bg-bip-card p-6">
        <h1 className="text-lg font-semibold text-bip-text">{title}</h1>
        {children}
      </div>
    </main>
  );
}

/** The consent screen for the Claude connector ("Allow Claude to …?"). */
export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const params = Object.fromEntries(
    AUTHORIZE_PARAMS.map((key) => [key, typeof raw[key] === "string" ? (raw[key] as string) : undefined]),
  ) as Record<string, string | undefined>;
  const check = await checkAuthorize(params);

  if (check.kind === "sign_in") {
    const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])));
    redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${query.toString()}`)}`);
  }
  if (check.kind === "invalid") {
    return (
      <Card title="This connection request can&apos;t be used">
        <p className="text-sm text-bip-muted">{check.message}</p>
        <p className="text-sm text-bip-muted">Nothing was shared. Try removing and re-adding the connector in Claude.</p>
      </Card>
    );
  }
  if (check.kind === "not_allowed") {
    return (
      <Card title="Admins only">
        <p className="text-sm text-bip-muted">
          You are signed in as {check.email}. Only Beyond Indigo admins can connect Claude to {POOBAH_NAME}. Nothing was shared.
        </p>
      </Card>
    );
  }

  const { client, user, request } = check;
  return (
    <Card title={`Allow ${client.clientName} to use ${POOBAH_NAME}?`}>
      <ul className="list-disc space-y-1 pl-5 text-sm text-bip-text">
        <li>Read every watched client: status, open items, log and account basics.</li>
        <li>Add clients to the watch list, update statuses, add log entries and open items, and change or complete items.</li>
        <li>It cannot delete anything. Its changes are recorded as “Claude (for {user.email.split("@")[0]})”.</li>
      </ul>
      <p className="text-xs text-bip-muted">
        Signed in as {user.email}. The connection returns to {new URL(request.redirectUri).host}. It lasts up to 30 days
        unless renewed, and stops at once if you stop being an admin.
      </p>
      <form action={decide} className="flex gap-2">
        {AUTHORIZE_PARAMS.map((key) => (params[key] ? <input key={key} type="hidden" name={key} value={params[key]} /> : null))}
        <button name="decision" value="allow" className="rounded-md bg-bip-accent px-4 py-2 text-sm font-medium text-white">
          Allow
        </button>
        <button name="decision" value="deny" className="rounded-md border border-bip-border px-4 py-2 text-sm text-bip-muted">
          Deny
        </button>
      </form>
    </Card>
  );
}
