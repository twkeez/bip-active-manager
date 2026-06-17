import type { Ga4ChannelRow, Ga4SignalDraft, Ga4Totals } from "@/lib/types/client";

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

export function buildGa4Signals(
  totals: Ga4Totals,
  previousTotals: Ga4Totals | null,
  channelBreakdown: Ga4ChannelRow[],
): Ga4SignalDraft[] {
  const signals: Ga4SignalDraft[] = [];

  // --- Session drop vs prior period ---
  if (previousTotals && previousTotals.sessions >= 50) {
    const delta = deltaPct(totals.sessions, previousTotals.sessions);
    if (delta !== null && delta <= -0.2) {
      signals.push({
        signal_id: "ga4_sessions_drop",
        severity: delta <= -0.35 ? "critical" : "watch",
        title: "Sessions dropped vs prior period",
        description: `Sessions fell ${pct(Math.abs(delta))} compared to the previous 30 days (${totals.sessions.toLocaleString()} vs ${previousTotals.sessions.toLocaleString()}).`,
        suggestion:
          "Check for tracking issues, lost ad spend, ranking drops, or seasonal causes. Compare channel breakdown to find where traffic fell.",
        metric_value: `${totals.sessions.toLocaleString()} sessions (${pct(Math.abs(delta))} drop)`,
        occurrence_key: "ga4_sessions_drop",
      });
    }
  }

  // --- Low engagement rate ---
  if (totals.sessions >= 100) {
    if (totals.engagement_rate < 0.3) {
      signals.push({
        signal_id: "ga4_low_engagement_rate",
        severity: "critical",
        title: "Critically low engagement rate",
        description: `Only ${pct(totals.engagement_rate)} of sessions are engaged — most visitors are bouncing without interacting.`,
        suggestion:
          "Review top landing pages for relevance and page speed. Ensure the page delivers on what the ad or search result promised.",
        metric_value: `${pct(totals.engagement_rate)} engagement rate`,
        occurrence_key: "ga4_low_engagement_rate",
      });
    } else if (totals.engagement_rate < 0.45) {
      signals.push({
        signal_id: "ga4_low_engagement_rate",
        severity: "watch",
        title: "Below-average engagement rate",
        description: `Engagement rate is ${pct(totals.engagement_rate)} — below the 45–65% range typical for vet practice sites.`,
        suggestion:
          "Audit top pages for clear calls to action, fast load times, and content that matches visitor intent.",
        metric_value: `${pct(totals.engagement_rate)} engagement rate`,
        occurrence_key: "ga4_low_engagement_rate",
      });
    }
  }

  // --- Zero conversions with significant sessions ---
  if (totals.sessions >= 150 && totals.conversions === 0) {
    signals.push({
      signal_id: "ga4_no_conversions",
      severity: "critical",
      title: "No conversions tracked",
      description: `${totals.sessions.toLocaleString()} sessions with zero conversion events — either conversion tracking is missing or broken.`,
      suggestion:
        "Verify that key events (contact form, phone click, appointment booking) are tagged as conversions in GA4.",
      metric_value: `${totals.sessions.toLocaleString()} sessions, 0 conversions`,
      occurrence_key: "ga4_no_conversions",
    });
  }

  // --- Channel signals (only if we have meaningful breakdown) ---
  const totalSessions = channelBreakdown.reduce((sum, r) => sum + r.sessions, 0);

  if (totalSessions >= 100) {
    const directRow = channelBreakdown.find(
      (r) => r.channel === "Direct" || r.channel === "direct",
    );
    const directShare = directRow ? directRow.sessions / totalSessions : 0;

    // High direct share can mean UTM tagging failure (paid/email traffic arriving untagged)
    if (directShare > 0.5 && totalSessions > 200) {
      signals.push({
        signal_id: "ga4_high_direct_share",
        severity: "watch",
        title: "Unusually high Direct traffic share",
        description: `${pct(directShare)} of sessions are attributed to Direct — this often means UTM parameters are missing on ad links, emails, or social posts.`,
        suggestion:
          "Audit campaign URLs to ensure all paid, email, and social links use UTM tags. Use the GA4 DebugView to confirm attribution.",
        metric_value: `${pct(directShare)} Direct (${directRow?.sessions.toLocaleString() ?? 0} sessions)`,
        occurrence_key: "ga4_high_direct_share",
      });
    }

    // New users drop vs prior period
    if (previousTotals && previousTotals.new_users >= 30) {
      const newUserDelta = deltaPct(totals.new_users, previousTotals.new_users);
      if (newUserDelta !== null && newUserDelta <= -0.25) {
        signals.push({
          signal_id: "ga4_new_users_drop",
          severity: "watch",
          title: "New user acquisition dropped",
          description: `New users fell ${pct(Math.abs(newUserDelta))} vs the prior period (${totals.new_users.toLocaleString()} vs ${previousTotals.new_users.toLocaleString()}).`,
          suggestion:
            "New users are driven by organic rankings, paid ads, and referrals. Check which channel lost share.",
          metric_value: `${totals.new_users.toLocaleString()} new users (${pct(Math.abs(newUserDelta))} drop)`,
          occurrence_key: "ga4_new_users_drop",
        });
      }
    }
  }

  return signals;
}
