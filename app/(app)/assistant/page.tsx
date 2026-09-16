import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getProfile } from "@/lib/auth/profile";
import { getGoogleScopesForUser } from "@/lib/google/token-manager";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import AssistantChat from "@/components/assistant/assistant-chat";

export const dynamic = "force-dynamic";
export const metadata = { title: "Assistant" };

/**
 * The planning assistant: your day, your task list, and where AI can help.
 *
 * Admins only. Its lookups read past row-level security through the same
 * read-only function the canaries use, and each question costs a few Claude
 * calls — neither of which belongs in front of the whole team yet.
 */
export default async function AssistantPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") redirect("/dashboard");

  const scopes = await getGoogleScopesForUser(createAdminClient(), user.id).catch(() => [] as string[]);
  const calendarConnected = scopes.includes("https://www.googleapis.com/auth/calendar.readonly");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
      <header>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-bip-accent" />
          <h1 className="text-xl font-semibold text-bip-text">Assistant</h1>
        </div>
        <p className="mt-1 text-sm text-bip-muted">
          Plans your day and keeps your task list honest. It can suggest changes to your tasks — nothing changes until you
          confirm, and everything it changes can be undone.
        </p>
      </header>
      <AssistantChat calendarConnected={calendarConnected} />
    </div>
  );
}
