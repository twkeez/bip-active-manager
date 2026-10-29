import { redirect } from "next/navigation";

// Data health now lives in Coal Mines (2026-10-29). Kept so emailed and
// bookmarked links still land in the right place.
export default function DataHealthPage() {
  redirect("/coal-mines?item=health");
}
