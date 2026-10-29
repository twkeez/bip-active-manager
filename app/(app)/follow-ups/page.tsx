import { redirect } from "next/navigation";

// Follow-ups are now a tab of the Response Report (2026-10-29). Kept so links
// in emails already sent still land in the right place.
export default function FollowupsPage() {
  redirect("/response-report?tab=followups");
}
