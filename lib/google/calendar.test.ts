import { describe, expect, it } from "vitest";
import { dateInZone, eventsOnDate } from "./calendar";

describe("dateInZone", () => {
  // 02:30 UTC on the 16th is still the evening of the 15th in New York.
  it("reads the date as the time zone sees it, not UTC", () => {
    expect(dateInZone(new Date("2026-09-16T02:30:00Z"), "America/New_York")).toBe("2026-09-15");
    expect(dateInZone(new Date("2026-09-16T02:30:00Z"), "Europe/London")).toBe("2026-09-16");
  });
});

describe("eventsOnDate", () => {
  const tz = "America/New_York";

  it("keeps only events that start on that day in that zone", () => {
    const events = eventsOnDate(
      [
        { summary: "Late call", start: { dateTime: "2026-09-16T02:00:00Z" }, end: { dateTime: "2026-09-16T03:00:00Z" } },
        { summary: "Dallas Highway review", start: { dateTime: "2026-09-16T18:00:00Z" }, end: { dateTime: "2026-09-16T18:30:00Z" } },
      ],
      "2026-09-16",
      tz,
    );
    // The 02:00 UTC call is 22:00 on the 15th in New York.
    expect(events.map((e) => e.title)).toEqual(["Dallas Highway review"]);
    expect(events[0].start).toBe("14:00");
    expect(events[0].end).toBe("14:30");
  });

  it("drops cancelled events and invitations you declined", () => {
    const events = eventsOnDate(
      [
        { summary: "Cancelled", status: "cancelled", start: { dateTime: "2026-09-16T15:00:00Z" } },
        { summary: "Declined", attendees: [{ self: true, responseStatus: "declined" }], start: { dateTime: "2026-09-16T16:00:00Z" } },
        { summary: "Kept", attendees: [{ self: true, responseStatus: "accepted" }, {}], start: { dateTime: "2026-09-16T17:00:00Z" } },
      ],
      "2026-09-16",
      tz,
    );
    expect(events.map((e) => e.title)).toEqual(["Kept"]);
    expect(events[0].attendees).toBe(2);
  });

  it("puts all-day events first and sorts the rest by time", () => {
    const events = eventsOnDate(
      [
        { summary: "Afternoon", start: { dateTime: "2026-09-16T19:00:00Z" } },
        { summary: "Morning", start: { dateTime: "2026-09-16T13:00:00Z" } },
        { summary: "Vet Tech Week", start: { date: "2026-09-16" }, end: { date: "2026-09-17" } },
      ],
      "2026-09-16",
      tz,
    );
    expect(events.map((e) => e.title)).toEqual(["Vet Tech Week", "Morning", "Afternoon"]);
    expect(events[0].allDay).toBe(true);
    expect(events[0].start).toBeNull();
  });

  it("names an untitled event rather than showing a blank", () => {
    const [event] = eventsOnDate([{ start: { dateTime: "2026-09-16T15:00:00Z" } }], "2026-09-16", tz);
    expect(event.title).toBe("(no title)");
  });
});
