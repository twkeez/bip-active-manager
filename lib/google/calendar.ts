import type { SupabaseClient } from "@supabase/supabase-js";
import { getGoogleAccessTokenForUser, getGoogleScopesForUser } from "@/lib/google/token-manager";

/**
 * One person's calendar, read-only, for the assistant.
 *
 * Personal, so it goes through that person's own Google connection — never
 * getGoogleAccessTokenForScope, which happily returns whichever connection has
 * the permission and is right for company-wide data like Ads, wrong for
 * someone's diary.
 */

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const API = "https://www.googleapis.com/calendar/v3";

/** Used only when the calendar cannot tell us — most of the roster is Eastern. */
export const FALLBACK_TIME_ZONE = "America/New_York";

export type CalendarEvent = {
  title: string;
  /** "09:30" in the calendar's own time zone, or null for all-day events. */
  start: string | null;
  end: string | null;
  allDay: boolean;
  location: string | null;
  attendees: number;
  /** First few hundred characters — enough to tell what the meeting is for. */
  description: string | null;
};

export type CalendarDay =
  | { connected: true; date: string; timeZone: string; events: CalendarEvent[] }
  | { connected: false; date: string; timeZone: string; reason: string };

type GoogleEvent = {
  status?: string;
  summary?: string;
  location?: string;
  description?: string;
  attendees?: Array<{ self?: boolean; responseStatus?: string }>;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

/** "YYYY-MM-DD" for an instant, as seen in a time zone. */
export function dateInZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

function timeInZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(instant);
}

/**
 * Events that fall on `date` in `timeZone`.
 *
 * The API wants RFC 3339 bounds with an offset, and working out a zone's offset
 * by hand is where daylight-saving bugs live. So the request asks for a
 * generous three-day window and this decides membership by formatting each
 * event's start in the zone — the platform's own time zone data does the work.
 */
export function eventsOnDate(
  events: GoogleEvent[],
  date: string,
  timeZone: string,
): CalendarEvent[] {
  return events
    .filter((event) => event.status !== "cancelled")
    // Invitations you declined are not part of your day.
    .filter((event) => !event.attendees?.some((a) => a.self && a.responseStatus === "declined"))
    .map((event) => {
      const allDay = Boolean(event.start?.date && !event.start?.dateTime);
      const startInstant = event.start?.dateTime ? new Date(event.start.dateTime) : null;
      const endInstant = event.end?.dateTime ? new Date(event.end.dateTime) : null;
      const onDate = allDay
        ? event.start?.date === date
        : startInstant !== null && dateInZone(startInstant, timeZone) === date;
      return {
        onDate,
        startSort: startInstant?.getTime() ?? 0,
        event: {
          title: event.summary?.trim() || "(no title)",
          start: startInstant ? timeInZone(startInstant, timeZone) : null,
          end: endInstant ? timeInZone(endInstant, timeZone) : null,
          allDay,
          location: event.location?.trim() || null,
          attendees: event.attendees?.length ?? 0,
          description: event.description?.trim().slice(0, 400) || null,
        },
      };
    })
    .filter((row) => row.onDate)
    // All-day events first, then by start time.
    .sort((a, b) => (a.event.allDay === b.event.allDay ? a.startSort - b.startSort : a.event.allDay ? -1 : 1))
    .map((row) => row.event);
}

async function googleGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${API}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message =
      (json.error as { message?: string } | undefined)?.message ?? `Calendar API HTTP ${response.status}`;
    throw new Error(message);
  }
  return json;
}

/**
 * A day's events. `date` defaults to today in the calendar's time zone.
 * Never throws for "not connected" — the assistant should say so, not crash.
 */
export async function fetchCalendarDay(
  admin: SupabaseClient,
  userId: string,
  date?: string,
): Promise<CalendarDay> {
  const scopes = await getGoogleScopesForUser(admin, userId);
  const fallbackDate = date ?? dateInZone(new Date(), FALLBACK_TIME_ZONE);
  if (!scopes.includes(CALENDAR_SCOPE)) {
    return {
      connected: false,
      date: fallbackDate,
      timeZone: FALLBACK_TIME_ZONE,
      reason:
        "Your Google connection does not include calendar access yet. Reconnect Google once to grant it.",
    };
  }

  const token = await getGoogleAccessTokenForUser(admin, userId);
  if (!token) {
    return { connected: false, date: fallbackDate, timeZone: FALLBACK_TIME_ZONE, reason: "Google is not connected." };
  }

  try {
    const calendar = await googleGet("calendars/primary", token);
    const timeZone = typeof calendar.timeZone === "string" ? calendar.timeZone : FALLBACK_TIME_ZONE;
    const day = date ?? dateInZone(new Date(), timeZone);

    const middle = new Date(`${day}T12:00:00Z`).getTime();
    const json = await googleGet("calendars/primary/events", token, {
      timeMin: new Date(middle - 36 * 3_600_000).toISOString(),
      timeMax: new Date(middle + 36 * 3_600_000).toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "100",
    });

    return {
      connected: true,
      date: day,
      timeZone,
      events: eventsOnDate((json.items as GoogleEvent[] | undefined) ?? [], day, timeZone),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calendar request failed";
    return {
      connected: false,
      date: fallbackDate,
      timeZone: FALLBACK_TIME_ZONE,
      // The API being switched off in the Cloud project reads very differently
      // from a permissions problem, and only one of them is fixed by reconnecting.
      reason: /has not been used|is disabled/i.test(message)
        ? "The Google Calendar API is not enabled in the app's Google Cloud project, so the calendar cannot be read yet."
        : `The calendar could not be read: ${message}`,
    };
  }
}
