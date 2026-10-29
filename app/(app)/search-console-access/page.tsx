import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { ToolPage } from "@/components/ui/tool-page";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { verificationConnectionStatus } from "@/lib/google/verification-connection";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Search Console access, admins only and not in the sidebar: the separate
 * Google connection used to give yourself Search Console access in bulk
 * through Tag Manager. Nothing here changes anything by itself.
 */
export default async function SearchConsoleAccessPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdmin(await getProfile(supabase))) redirect("/");
  const params = await searchParams;
  const status = await verificationConnectionStatus(createAdminClient(), user.id);

  return (
    <ToolPage
      title="Search Console access"
      icon={KeyRound}
      maxWidth="3xl"
      description="A separate Google connection, for admins only, that lets BIP Control read Tag Manager, verify you as a site's owner through Tag Manager and add the site to your Search Console. Your everyday Google connection is untouched."
    >
      {params.connected && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">Connected.</p>}
      {params.error && <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">Google didn&apos;t connect: {params.error}</p>}

      <section className="space-y-3 rounded-xl border border-bip-border bg-bip-card p-5 text-sm">
        {status ? (
          <>
            <p className="text-bip-text">
              Connected as <span className="font-semibold">{status.email ?? "an unknown Google account"}</span> on {new Date(status.connectedAt).toLocaleString()}.
            </p>
            {status.missingScopes.length > 0 && (
              <p className="text-amber-300">
                Google didn&apos;t grant {status.missingScopes.length} of the permissions needed. Connect again and tick every box on Google&apos;s screen.
              </p>
            )}
          </>
        ) : (
          <p className="text-bip-muted">Not connected yet.</p>
        )}
        <p className="text-bip-muted">
          Use the Google account that should own the sites in Search Console (tom@beyondindigo.com: it&apos;s the one the nightly sync reads with). Google will ask to let BIP
          Control view and manage Tag Manager users, verify site ownership, and manage Search Console.
        </p>
        <a href="/api/google/verification-oauth/start" className="inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
          <KeyRound size={14} /> {status ? "Connect again" : "Connect Google for site verification"}
        </a>
      </section>
    </ToolPage>
  );
}
