import { redirect } from "next/navigation";

/**
 * Routines live in Coal Mines, beside the canaries, since both are things that
 * watch. This address is kept so links to it still land somewhere sensible.
 */
export default function RoutinesPage() {
  redirect("/coal-mines?item=routine:daily-basecamp-review");
}
