import Link from "next/link";
import { redirect } from "next/navigation";
import { Sunrise } from "lucide-react";
import DailyBriefView from "@/components/daily-brief/daily-brief-view";
import RefreshButton from "@/components/daily-brief/refresh-button";
import TodayPanel from "@/components/daily-brief/today-panel";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { ToolPage } from "@/components/ui/tool-page";
import { loadDayContext, type DayContext } from "@/lib/assistant/day-context";
import { getProfile } from "@/lib/auth/profile";
import { REMINDER_TIMEZONE } from "@/lib/briefing-reminders/plan";
import { loadSavedBrief } from "@/lib/daily-brief/load";
import { dateInZone } from "@/lib/google/calendar";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * The daily brief: every active client in order of how much they need you,
 * with today's calendar, tasks and Coal Mines above. The client list is built
 * each weekday morning by the "Daily Brief" routine and saved, so earlier days
 * stay available; today's panel is read live.
 */
export default async function DailyBriefPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/daily-brief");
  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") redirect("/");

  const params = await searchParams;
  const requested = typeof params.date === "string" ? params.date : undefined;

  const admin = createAdminClient();
  const { saved, recentDates, error } = await loadSavedBrief(admin, requested);
  const viewingLatest = !saved || saved.date === recentDates[0];

  let day: DayContext | null = null;
  let dayError: string | null = null;
  if (viewingLatest) {
    try {
      day = await loadDayContext(supabase, admin, profile.id);
    } catch (caught) {
      dayError = caught instanceof Error ? caught.message : "Today's calendar and tasks could not be read.";
    }
  }

  const todayEastern = dateInZone(new Date(), REMINDER_TIMEZONE);
  const stale = saved && viewingLatest && saved.date !== todayEastern;

  return (
    <ToolPage
      title="Daily Brief"
      icon={Sunrise}
      maxWidth="6xl"
      description={
        saved
          ? `Brief for ${saved.date}. Every active client, most pressing first: onboarding, then clients chasing us, then needs action, then keep an eye on.`
          : "Every active client, most pressing first."
      }
      actions={<RefreshButton label={saved?.date === todayEastern ? "Refresh now" : "Build today's brief"} />}
    >
      {error && <ErrorState message={error} />}
      {dayError && <ErrorState message={dayError} />}
      {day && <TodayPanel context={day} />}

      {recentDates.length > 1 && (
        <nav className="flex flex-wrap items-center gap-2 text-xs text-bip-muted" aria-label="Earlier briefs">
          <span>Earlier:</span>
          {recentDates.map((date) => (
            <Link
              key={date}
              href={date === recentDates[0] ? "/daily-brief" : `/daily-brief?date=${date}`}
              className={`rounded-full border px-2 py-0.5 ${
                date === saved?.date ? "border-bip-accent text-bip-text" : "border-bip-border hover:bg-bip-hover"
              }`}
            >
              {date}
            </Link>
          ))}
        </nav>
      )}

      {stale && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Today&apos;s brief has not been built yet, so this is the brief from {saved.date}. It builds automatically on weekday mornings,
          or use the button above.
        </p>
      )}

      {saved ? (
        <DailyBriefView brief={saved.brief} />
      ) : (
        !error && (
          <EmptyState
            icon={Sunrise}
            title="No brief has been built yet"
            hint="It builds automatically on weekday mornings. Use the button above to build the first one now."
          />
        )
      )}
    </ToolPage>
  );
}
